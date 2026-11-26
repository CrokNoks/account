# Conception : suppression propre d'une période (parties sensibles)

Trois parties sensibles : (1) suppression atomique, (2) annulation de bascule (mémoire à la bascule + réouverture), (3) aperçu. Tout vit en SQL, deux fonctions SECURITY INVOKER sur le modèle de `apply_period_switches` ; le TS ne fait que transmettre et loguer.

## Ce que ça décide
Entrée : l'id d'une période. Sortie : la période, ses budgets et ses `pending` récurrentes disparaissent ; les autres transactions restent, rattachées à la période rouverte si c'est une annulation de bascule, sinon sans période ; l'aperçu annonce les mêmes nombres sans rien écrire. La règle est écrite **une seule fois** (`period_deletion_plan`), appelée par l'aperçu et par la suppression.

## Données : mémoire de bascule (migration 1)
Trois colonnes sur `periods`, toutes nullables ou à défaut, posées seulement par `apply_period_switches` sur la période qu'elle ouvre :
- `opened_by_trigger boolean not null default false` (origine, sert au log et au test « déclencheur »)
- `closed_period_id uuid null references periods(id) on delete set null` (la période close : si elle est supprimée plus tard, le lien disparaît, donc CA5 simple)
- `closed_period_end date null` (la fin qu'elle avait avant la close ; null = elle n'en avait pas)

`CREATE OR REPLACE apply_period_switches` (même signature, même corps) ; seuls changent, dans la boucle de l'étape 2 : lecture de la fin d'avant, puis l'INSERT de la période ouverte écrit les 3 colonnes. Fin d'avant = `p_switches[i].closed_prev_end` si la clé est présente (le back à jour la passe toujours), sinon lecture de `end_date` de la période close juste avant l'UPDATE (ancien back : même résultat pour la première bascule). Clé absente ≠ null : test `v_switch ? 'closed_prev_end'`.
Import chaîné : le planificateur réécrit la fin de B quand C la clôt (`period-switch.ts:462-468`). Il garde donc, **avant** la réécriture, la fin planifiée (`closed.prevEnd`) ; pour la première bascule c'est la fin réelle de l'active (le service la connaît). Le service/dépôt la transmettent (`closed_prev_end`).
Comportement inchangé : `period_trigger_test.sql` existant doit passer sans une ligne modifiée ; on lui ajoute seulement des assertions sur les 3 colonnes.

## L'algorithme (migration 2)
`period_deletion_plan(p_period_id) returns jsonb`, STABLE, INVOKER (RLS de l'appelant), ne lit que :
1. La période D (invisible : `P0002`, 404). `removed_pending` = `count(*)` des transactions `account_id = D.account_id AND period_id = D AND pending AND metadata->>'source' = 'recurring'`. `kept` = transactions de D − `removed_pending`.
2. `reopen` = X si toutes les conditions : D active ; aucune période du compte de `start_date` > D (dernière, même règle que `hasNewerPeriod`) ; `D.closed_period_id` non null et X existe ; X inactive ; X est la dernière une fois D retirée (aucune autre période avec `start_date` > X). Sinon `reopen` = null (CA5, et évite un 409 par chevauchement).
3. Retour `{removedPending, keptTransactions, reopenId, reopenStart, reopenEnd, origin}` (`origin` = `trigger` si `opened_by_trigger`, sinon `manual`).

`preview_delete_period(p_period_id)` = ce plan, rien d'autre (route `GET /:accountId/periods/:id/deletion-preview`). Pas de verrou, aucune écriture, aucun jeton : le nombre n'engage pas (CA3).

`delete_period_clean(p_period_id) returns jsonb`, INVOKER, `SET search_path = public, pg_temp`, une transaction :
1. `SELECT … WHERE id = p_period_id` (sans verrou) : absent ⇒ `P0002`. Puis `SELECT … FOR UPDATE` : ne rend rien ⇒ `42501` (lecture seule : RLS UPDATE masque la ligne ; c'est pourquoi on lit d'abord sans verrou, sinon un lecteur verrait un 404 au lieu d'un 403). Verrouille ensuite X si `closed_period_id` non null (ordre constant : D puis X). Un déclenchement concurrent (`apply_period_switches` verrouille l'active) est sérialisé avec nous.
2. Plan lu **après** les verrous, dans une instruction séparée (READ COMMITTED : voit ce qui s'est validé pendant l'attente).
3. `DELETE FROM transactions WHERE account_id … AND period_id = D AND pending AND metadata->>'source'='recurring'` : le filtre `pending` est réévalué dans cette instruction (une ligne pointée entre-temps reste). `removed` = `ROW_COUNT` (c'est lui qui est loggué et renvoyé, pas la valeur du plan).
4. Si `reopen` : `UPDATE transactions SET period_id = X WHERE period_id = D` (avant la suppression, sinon `ON DELETE SET NULL` les perdrait) ; `kept` = `ROW_COUNT`.
5. `DELETE FROM periods WHERE id = D` (cascade budgets) ; `ROW_COUNT <> 1` ⇒ `42501` (comme `apply_period_switches`). Annule aussi l'étape 3.
6. Si `reopen` : `UPDATE periods SET is_active = true, end_date = D.closed_period_end WHERE id = X` ; `ROW_COUNT <> 1` ⇒ `42501`. Après le DELETE : une seule active et pas de chevauchement tiennent à chaque instant ; les index (`periods_one_active_per_account`, exclusion gist) restent le filet (23505/23P01 ⇒ 409, tout annulé).
7. Retour `{removedPending, keptTransactions, reopenedPeriodId|null, origin}`. REVOKE ALL FROM PUBLIC, anon ; GRANT authenticated, pour les 3 fonctions.

Back : `PeriodRepository.delete(id)` appelle le RPC et rend ce résultat ; `DeletePeriodUseCase` (mince : `getOwnedPeriod`, RPC, log `period_deleted` sans libellé ni montant) ; le contrôleur répond toujours 204 sans corps. `toDomainError` : 42501 ⇒ 403, P0002 ⇒ 404, 23505/23P01 ⇒ 409.

## Cas particuliers
- Paie déclenchante (non pending, ou `pending` sans `source`) : conservée même si datée après la fin. Elle prend la période X (fin 30/11 couvre le 25/11) ; la prochaine paie du 25/12 est `recurring` + `pending` : supprimée.
- `pending` récurrente payée (`pending = false`), côté de virement `pending` (pas de `source`), `pending` d'une autre période : conservées / intactes.
- Fin d'avant écrasant une fin modifiée à la main depuis la bascule : voulu (spec). Fin d'avant null : X rouverte sans fin.
- Import A→B→C→D : D supprimée ⇒ C rouverte avec sa fin planifiée ; B, A inchangées ; C supprimée ensuite ⇒ B rouverte (son `closed_period_id` = A).

## Exploitation et retour arrière
Log `period_deleted` (accountId, periodId, `removedPending`, `keptTransactions`, `reopenedPeriodId`, `origin`) émis par le use case après succès. Retour arrière : revert du code ; la migration 1 ne se défait pas toute seule (colonnes nullables, inoffensives) ; pour revenir à l'ancienne fonction : rejouer `CREATE OR REPLACE` de `20261125100000_period_trigger.sql` (étape 2) ; `DROP FUNCTION` des 3 nouvelles fonctions. En-tête de migration : ces commandes.

## Alternatives écartées
- Faire le tout en TS (plusieurs appels REST) : pas d'atomicité (CA7).
- Ajouter la suppression à `apply_period_switches` : fonction déjà à 7 paramètres, intention différente.
- Rejouer la bascule à l'envers depuis la date de la déclencheuse (sans colonnes) : fin d'avant introuvable si modifiée, et import chaîné ambigu.
- Table d'historique des bascules : 3 colonnes suffisent (0 donnée en prod).
- Jeton d'aperçu à rejouer à la suppression : la spec veut la règle appliquée à l'exécution, le nombre n'est qu'une annonce.
- Verrou advisory : le `FOR UPDATE` sur D (et X) suffit.

## Cas de test (SQL `supabase/tests/delete_period_test.sql`, ROLLBACK final ; TS et e2e en face)
| Cas | Résultat attendu | Pourquoi |
| --- | --- | --- |
| Exemple spec : D 25/11→24/12 active, ouverte par déclencheur (X fin d'avant 30/11), 3 récurrentes pending + prochaine paie 25/12 pending, paie 25/11 pointée, saisie 18,50 du 27/11, pending manuelle, récurrente payée | 4 supprimées (`removedPending` = 4), D et budgets disparus, X active fin 30/11 ; les 4 autres restent | CA1, CA2, CA4 |
| Idem : période des deux conservées (paie 25/11, saisie 27/11) | = X, jamais NULL | règle unique CA4, paie rattachée à la période qui finit le 30/11 |
| Rattachement et suppression dans la même transaction : trigger temporaire qui échoue au DELETE de D (bloc DO + exception) | pending toujours là, `period_id` toujours D, X toujours inactive | CA7, atomicité (aucun état intermédiaire) |
| Idem, échec à la réouverture de X (trigger sur UPDATE periods) | D et pending intactes | CA7 |
| Période manuelle (`opened_by_trigger` faux) | pending nettoyées, rien rouvert, conservées sans période | CA5 |
| D inactive / non dernière / `closed_period_id` null / X supprimée avant (FK) / X non dernière après D | suppression simple, rien rouvert | CA5, décision 3 |
| Import A→B→C→D (`apply_period_switches` à 3 bascules) : supprimer D, puis C | C rouverte avec sa fin planifiée, B et A inchangées ; puis B rouverte | CA6 |
| Colonnes après `apply_period_switches` : 1 bascule, 3 bascules, clé `closed_prev_end` absente | 3 colonnes justes ; clé absente ⇒ fin lue en base | mémoire, compat ancien back |
| `period_trigger_test.sql` existant | vert, inchangé | comportement identique |
| Lecture seule : delete | `42501`, aucune période/pending/X modifiée ; aperçu OK | CA7 |
| Période d'un autre compte / inconnue | `P0002` | accès |
| Pending pointée avant l'appel (aperçu annonçait 4) | suppression : 3 supprimées, la pointée reste | filtre relu |
| Aperçu : mêmes nombres que la suppression ; comptes de lignes, périodes et actives identiques avant/après | aucune écriture | CA3, nombre non engageant |
| Recréation avec `injectRecurring` après suppression (use case + e2e) | une occurrence par récurrente, 0 doublon | CA8 |
| Deux DELETE simultanés de D / DELETE pendant une bascule (2 sessions, scratchpad) | un seul réussit (l'autre 404) / sérialisés, plan relu après verrou | concurrence, hors transaction annulée |

## Ordre des commits de code
1. **Sensible : mémoire de bascule.** Migration `…_period_switch_memory.sql` (3 colonnes + `apply_period_switches`), `period-switch.ts` (`closed.prevEnd`), `apply-period-switch.service.ts`, `period.repository.interface.ts` / `supabase-period.repository.ts` (`closed_prev_end`), tests (`period_trigger_test.sql`, `period-switch.spec.ts`, service spec, repo spec). Livrable seul, sans effet visible.
2. **Sensible : suppression atomique + aperçu.** Migration `…_delete_period_clean.sql` (plan, aperçu, suppression), dépôt, `DeletePeriodUseCase`, contrôleur (`remove` + route d'aperçu), log ; `delete_period_test.sql`, `delete-period.use-case.spec.ts`, repo spec, `periods-deletion.e2e-spec.ts`.
3. **Non sensible : front** (`period-list.tsx`, `use-delete-period.ts`, hook d'aperçu, `fr.json`/`en.json`, test) + `functions/http/suppression-periode.http`.

Deux migrations au lieu d'une (écart à « Fichiers concernés ») : chaque commit reste livrable et testé.

## Ordre de déploiement
Migration d'abord (`db push`), puis back, puis front. Migration seule : additive, l'ancien back garde son `DELETE` simple (colonnes nullables, FK `SET NULL`). Back avant migration : bascules inchangées (clé ignorée, colonnes non écrites donc périodes traitées comme manuelles) mais DELETE en erreur 500 (RPC absente) jusqu'au `db push` ; aucune donnée touchée. Front avant back : aperçu 404 ; à ne pas faire. Les deux ordres sont sans perte de données ; seul l'ordre recommandé évite l'indisponibilité de la suppression.

## Fichiers sensibles
`supabase/migrations/…_period_switch_memory.sql`, `…_delete_period_clean.sql`, `functions/src/periods/domain/period-switch.ts`, `application/apply-period-switch.service.ts`, `application/delete-period.use-case.ts`, `infrastructure/supabase-period.repository.ts` (appels RPC), `supabase/tests/delete_period_test.sql`. Pensés pour `utility_functions_privileges_test.sql` : y ajouter les 3 fonctions.
Non sensibles : contrôleur (câblage, route), front (confirmation avec nombres + période rouverte, messages fr/en, `period-list.test.tsx`), `.http` (D 25/11 → 24/12 avec acteurs : propriétaire, lecteur 403, étranger 404, anonyme 401), requête de mesure (spec, à exécuter en local avant de la donner : `metadata->>'recurringId'`, `having count(*) > 1`).

## À trancher par Lucas
1. **Fin d'avant dans un import chaîné** : fin *planifiée* de B avant réécriture (proposé : C rouverte retrouve sa fin naturelle) ou fin *écrite* en base (= veille de la bascule suivante). Je prends la première.
2. **Réouverture seulement si X est la dernière après suppression** (ajout à la spec, évite un 409) : sinon suppression simple. OK ?
3. **Deux migrations** (une par commit) au lieu d'une.
4. **Aperçu** : `GET …/periods/:id/deletion-preview` ; la période rouverte est annoncée par ses dates de début et de fin (aucun montant). OK ?
5. **Refus de réouverture silencieux** : si les conditions manquent, on supprime sans rouvrir et l'écran n'a rien à annoncer (aperçu = vérité). OK ?

## Validé par Lucas (contrôle 1, 2026-11-26 : « Go reco ») ; prime sur ce qui précède
1. Import A→B→C→D puis annulation de D : C est rouverte avec sa fin planifiée (celle qu'elle avait à sa création), pas la veille de D.
2. Réouverture seulement si la période close redevient la dernière du compte après suppression ; sinon simple suppression (ajout à la spec).
3. Deux migrations, une par commit.
4. Aperçu par une route de lecture dédiée ; période rouverte annoncée par ses dates, sans montant.
5. Condition de réouverture manquante : simple suppression, l'aperçu n'annonce aucune réouverture.

## Validé par Lucas (contrôle 2, 2026-11-26 : « Go dates et commit toi même »)
Code validé ; commits faits par l'orchestrateur. Dates de la confirmation et des titres de la liste des périodes formatées selon la langue (défaut existant corrigé dans ce cycle).
