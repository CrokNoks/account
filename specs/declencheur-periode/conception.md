# Conception : déclencheur de période (parties sensibles)

Trois parties sensibles : (1) récurrentes à cheval (CA8), (2) calcul de la bascule (dates, seuil, ordre, prochaine paie, réécriture de date), (3) écriture atomique sous concurrence. Le reste est non sensible (voir fin).

## Où porter le réglage : la catégorie
Colonne `categories.is_period_trigger boolean not null default false` + index unique partiel `(account_id) where is_period_trigger` (une seule par compte). Marquer une autre retire la première : fonction SQL `set_period_trigger_category(p_category_id, p_value)` (deux UPDATE dans une transaction, sinon l'index refuse), SECURITY INVOKER : RLS des catégories = accès écriture, catégorie d'un autre compte invisible donc refusée (404).
Rejeté : colonne sur `accounts` (UPDATE réservé au propriétaire, un membre en écriture ne pourrait plus régler ; l'écran Catégories est le bon endroit).

## 1. Récurrentes à cheval (CA8), commit 1, sans migration
Fonction pure `recurringOccurrences(dayOfMonth, start, end): Date[]` dans `shared/domain/recurring-day.ts` : pour chaque mois civil de start à end, date = `dateOnly(an, mois, recurringDayInMonth(jour, ce mois))`, gardée si start <= date <= end, ordre croissant. `create-period-with-budgets` l'appelle pour chaque récurrente (plusieurs occurrences possibles). Non-réinjection (c) : une occurrence est sautée si une transaction de même `metadata.recurringId` existe déjà dans le même mois civil (lecture des transactions du compte sur [début de mois du start ; fin de mois du end]). Aucune écriture de plus : même appel atomique `createWithBudgets`.
Ajout non sensible dans ce commit : log `period_opened` `origin: 'manual'`.

## 2. Calcul de la bascule : fonction pure `planPeriodSwitch` (`periods/domain/period-switch.ts`)
Aucune E/S. Entrée : date de la déclencheuse, active `{id, start}` (ou absente), `today`, récurrentes du compte, transactions récurrentes existantes (recurringId, date, pending), montants par défaut du compte, id déclencheur. Sortie : `{skip: raison}` ou `{closeEnd, newPeriod{start,end}, budgets, injected[], nextPaie|null}`.
1. Refus (raison loguée `period_trigger_skipped`) : `pending` (création) / date > today (`future`) ; pas d'active (`no_active`) ; écart = date − début active < 15 jours (`threshold`, donc aussi date <= début ; 14 rien, 15 bascule) ; virement/catégorie nulle (`not_trigger`).
2. closeEnd = date − 1 jour ; newStart = date.
3. Paies = récurrentes de catégorie déclencheuse, montant > 0 ; leurs occurrences à partir de newStart (via `recurringOccurrences` sur newStart..newStart + 2 mois). Prochaine = première date >= newStart + 15 j, la plus proche si plusieurs récurrentes. Sans prochaine : newEnd = newStart + 1 mois − 1 jour (règle actuelle, ramenée au dernier jour du mois). Avec : newEnd = prochaine − 1 jour.
4. Injection dans newStart..newEnd : `recurringOccurrences` de chaque récurrente, sauf (c) déjà présente le même mois civil (existantes + celles déjà planifiées), sauf paie à < 15 j du début (d). La déclencheuse elle-même n'est jamais un doublon.
5. nextPaie (`pending`, date newEnd + 1, `metadata.recurringId`, période = la nouvelle, hors fenêtre par ses dates) créée sauf si une transaction de cette récurrente, `pending`, datée >= newStart + 15 j existe déjà (précision canard). Une récurrente négative ne déclenche pas la règle A.
6. Sortie du pending : `isLeavingPending(avant, après)` dans `pending-rule.ts` (pending true → false, y compris par `reconciled: true`). Si catégorie finale = déclencheuse : date = `todayDateOnly()` (fuseau métier), la date envoyée est ignorée (H2), puis étapes 1-5 avec cette date ; sous le seuil : date du jour mais pas de bascule. Autres catégories : date inchangée.
7. Import / lot : déclencheuses non `pending` triées par date ; simulation séquentielle (l'active simulée devient la nouvelle période ; seuil mesuré à son début ; injections planifiées comptées comme « existantes » pour (c)). Seule la dernière bascule du lot injecte `nextPaie` (les précédentes ont pour « prochaine paie » la déclencheuse suivante du lot ; sa clôture réécrit leur fin : closeEnd = date − 1). Chaque ligne du lot reçoit le `period_id` de la période (planifiée ou active) dont la fenêtre contient sa date ; hors fenêtre : NULL (le trigger garde son comportement actuel). Lot de sorties du pending (PATCH en lot) : toutes les sorties déclencheuses prennent la date du jour, une seule bascule.

## 3. Écriture atomique et concurrence : `apply_period_switches` (migration)
Une seule fonction SQL, SECURITY INVOKER (RLS de l'appelant, comme `create_period_with_budgets`), appelée seulement si le plan contient une bascule ; sans bascule, les chemins actuels (`save_transaction`, `create_transactions`, `update_transactions`) restent inchangés.
`apply_period_switches(p_expected_active_id, p_switches jsonb, p_transactions jsonb) returns jsonb`
1. `SELECT … FROM periods WHERE account_id AND is_active FOR UPDATE` : verrou de ligne sur l'active (sérialise les déclenchements concurrents). Si l'id <> `p_expected_active_id` (ou plus d'active) : pas de bascule ; les lignes sont écrites via `upsert_transactions` avec les `period_id` « planifiés » remplacés par NULL (trigger `assign_period_id`) ; retour `{switched:false, reason:'concurrent'}`.
2. Sinon, pour chaque bascule dans l'ordre : UPDATE de l'active (`end_date = closeEnd`, `is_active = false`) en **vérifiant `ROW_COUNT = 1`** (sinon `RAISE 42501` : un membre en lecture seule est vu par RLS mais l'UPDATE ne touche rien, silencieusement), INSERT période + budgets (UNIQUE period/catégorie), puis rattachement `UPDATE transactions SET period_id = nouvelle WHERE account_id AND date BETWEEN start AND end` (H1), puis `upsert_transactions` des lignes injectées + `nextPaie`.
3. `upsert_transactions(p_transactions)` : la déclencheuse (création ou sortie, avec sa nouvelle date) et le reste du lot. Toute erreur annule tout (CA5). L'index `periods_one_active_per_account` reste le filet.
4. Retour `{switched:true, switches:[{closed:{id,start,end}, opened:{id,start,end}}]}` : le contrôleur le renvoie en `periodSwitch` (CA6) et loggue `period_opened origin:'trigger'`.
Le trigger `assign_period_id` n'est **pas modifié** (il ne remplit que `period_id` NULL) : la déclencheuse arrive avec le `period_id` explicite de la nouvelle période. La spec disait le contraire (« Change le trigger »), voir écarts.
Service d'orchestration unique `ApplyPeriodSwitchService` (`periods/application`) : lit active/récurrentes/catégorie déclencheuse, appelle `planPeriodSwitch`, appelle le dépôt ; appelé par les 4 chemins (création, import, PATCH, lot) : règle écrite une fois. Le contrôleur et les use cases ne font que passer les données.

## Compatibilité de déploiement (tag = functions + front, `db push` après)
- Migration purement additive (colonne défaut false, deux fonctions, un index). Le dépôt des catégories lit `select('*')` : le nouveau code, avant la migration, voit `isPeriodTrigger` absent = false, donc aucune bascule, aucune erreur ; `apply_period_switches` n'est jamais appelée tant que rien n'est marqué.
- Migration avant le code : l'ancien code ignore la colonne et les fonctions. Les deux ordres sont sûrs.
- Seul trou : entre le tag et le `db push`, le bouton « déclencheur » du front échoue (la fonction `set_period_trigger_category` n'existe pas) ; il se corrige au `db push`. Pas de drapeau de plus : le réglage vide en tient lieu.
- RLS : rien de nouveau à écrire (colonne de `categories`, politiques existantes ; fonctions INVOKER avec `REVOKE ALL FROM PUBLIC` + `GRANT authenticated`, comme les autres).

## Exploitation et retour arrière
Logs : `period_opened` (`origin`, accountId, periodId, start, end, `injected`, `nextPaie`) ; `period_trigger_skipped` (raison : `threshold|pending|future|no_active|not_trigger|concurrent`, écart en jours, sans libellé ni montant). Retour arrière : retirer la marque (tout s'éteint sans déploiement) ; revert du code ; migration laissée (inoffensive), ou `drop function`, `drop index`, `drop column` à la main. CA8 se revert seul (commit 1).

## Alternatives rejetées
- Verrou applicatif / `pg_advisory_lock` : inutile, le `FOR UPDATE` sur l'active suffit.
- Plan calculé en SQL : algorithme trop long à tester en SQL ; TS pur + SQL qui applique.
- Retenter la seconde bascule concurrente : la spec veut « enregistrée sans bascule ».
- Modifier `assign_period_id` : inutile avec `period_id` explicite.
- Table d'historique des bascules : les logs suffisent.

## Cas de test (pure d'abord, puis SQL/e2e pour l'atomicité)
| Cas | Résultat attendu |
| --- | --- |
| Prime : active débutée 1er nov., déclencheuse le 10 nov. (écart 9) | enregistrée, aucune bascule, log `threshold` |
| Écart 14 / 15 jours | 14 : rien ; 15 : bascule |
| Deux saisies simultanées (même active) | une seule bascule, une seule active ; la seconde enregistrée sans bascule, `period_id` NULL → trigger, log `concurrent` |
| Échec à l'ouverture (budget en doublon / erreur simulée) | tout annulé : active inchangée, transaction non créée, 1 seule active |
| Lecture seule | 403, rien modifié (`ROW_COUNT` ≠ 1) |
| Paie prévue 28 nov. sortie le 1er déc. | date = 1er déc. ; ancienne finit 30 nov. ; nouvelle 1er → 27 déc. ; paie du 28 déc. en `pending`, une seule fois |
| Paie prévue 1er déc. sortie le 28 nov. | date = 28 nov. ; nouvelle dès le 28 nov. ; occurrence du 1er déc. (3 j) non injectée ; prochaine = 1er janv. ; fin 31 déc. ; `pending` au 1er janv. |
| Import de 3 paies passées (28 sep., 28 oct., 28 nov.) | 3 bascules dans l'ordre ; chaque ligne dans la période contenant sa date ; pas de `pending` en doublon sauf la dernière prochaine paie |
| Import avec une paie < 15 j après la précédente | la seconde sans bascule |
| Date rétroactive (paie datée il y a 5 j, active depuis >= 15 j avant cette date) | ancienne finit la veille de cette date ; opérations déjà saisies depuis cette date rattachées à la nouvelle, comptées une fois |
| Date rétroactive <= début de l'active / aucune active | enregistrée, rien (`threshold` / `no_active`) |
| Création `pending` ou date future | rien |
| Sortie d'une paie datée dans le futur | date = aujourd'hui, bascule |
| Sortie d'une facture non déclencheuse | date inchangée, pas de bascule |
| Sortie en lot de 2 paies | date du jour pour les deux, une seule bascule |
| Catégorie modifiée seule / virement app | aucune bascule |
| Aucune récurrente de paie | fin = début + 1 mois − 1 jour |
| Plusieurs paies récurrentes | la plus proche >= 15 j |
| Paie récurrente négative | règle A non appliquée |
| Occurrence à 14 / 15 jours du début | 14 : ni fin ni injection ; 15 : prochaine paie |
| Période à cheval 25 oct. → 24 nov., récurrente jour 5 | créée le 5 nov. ; période > 1 mois : plusieurs occurrences |
| Récurrente déjà présente dans le mois (y compris ancienne période) | non réinjectée |
| Jour 31 sur mois court | ramenée au dernier jour |

## Fichiers sensibles et ordre des commits
Sensibles : `shared/domain/recurring-day.ts` (+spec), `periods/application/create-period-with-budgets.use-case.ts`, `periods/domain/period-switch.ts` (nouveau, +spec), `transactions/domain/pending-rule.ts` (+spec), `periods/application/apply-period-switch.service.ts` (nouveau), `supabase-period.repository.ts` (appel RPC), migration SQL `supabase/migrations/2026112510xxxx_period_trigger.sql`.
1. `feat(periods)` : récurrentes à cheval (CA8) + log `origin:'manual'` ; sensible, sans migration, livrable seul.
2. `feat(periods)` : déclencheur côté back : réglage catégorie (entité, contrôleur, dépôt, RPC), migration, planner, service, câblage des 4 chemins (création, import, PATCH, lot) avec `periodSwitch` dans les réponses, logs. Un commit pour ne jamais livrer un test rouge ni une migration sans code.
3. `feat(frontend)` : toggle Catégories, message CA6, ligne « À traiter » CA7, messages fr/en, `functions/http/declencheur-periode.http`.

## Non sensible (mode standard, sans attendre)
Front entier du commit 3 (contrat : `category.isPeriodTrigger` en lecture et PATCH ; `periodSwitch?: {closed, opened}` dans les réponses de création, PATCH, lot, import), DTO et validations, messages fr/en, ligne `todo_…` et son test, rafraîchissement des caches, fichier `.http`. Mais le front dépend du contrat ci-dessus : ne le coder qu'après l'API ou en le prenant tel quel.

## Points à confirmer par Lucas
- La déclencheuse d'un lot qui n'a pas de bascule reste sur le `period_id` donné par le trigger actuel (active), y compris si sa date est antérieure : comportement existant conservé.
- Date rétroactive très ancienne : la nouvelle période peut être déjà terminée et la `pending` de la prochaine paie datée dans le passé (voir écarts).

## Validé par Lucas (contrôle 1, 2026-11-25 : « Go ») ; prime sur ce qui précède
- Non-réinjection (c) : à la bascule seulement. La création manuelle injecte toutes les occurrences (CA8), sans contrôle de doublon.
- Rattachement H1 : transactions du compte datées >= début de la nouvelle période, sans borne de fin.
- Import de plusieurs paies : seule la dernière bascule du lot crée la prochaine paie en `pending`.
- Paie datée très en arrière : pas de garde-fou.
- Ligne d'import hors de toute période : `period_id` NULL, donc période active par le trigger, comme aujourd'hui.

## Nettoyage à l'import (choix « équivalent » de Lucas, contrôle 2, 2026-11-25 ; prime sur ce qui précède)
Import seulement, et seulement s'il y a bascule. Jamais à la saisie simple ni à la sortie du `pending`.
1. Périodes intermédiaires d'un import : aucune récurrente injectée. Seule la dernière bascule injecte.
2. Suppression d'une transaction existante si : `metadata.recurringId`, encore `pending`, datée dans la période active close (de son début à closeEnd de la première bascule) ou, pour la catégorie déclencheuse, jusqu'à 7 jours après la ligne importée ; et une ligne importée non `pending` équivalente : même catégorie non nulle, même signe, écart de date <= 7 jours.
3. Appariement un pour un : une ligne n'efface qu'une `pending` ; à plusieurs candidates, montant le plus proche, puis date la plus proche, puis id (résultat déterministe). Le montant n'est pas une condition.
4. Une occurrence que la dernière bascule allait injecter n'est pas créée si une ligne importée non encore appariée en est l'équivalent (mêmes critères). La prochaine paie n'est jamais concernée.
5. Une `pending` supprimée compte toujours comme « déjà présente » pour (c), jamais pour la prochaine paie (b).
6. Écriture dans `apply_period_switches` : paramètre séparé d'ids à supprimer, filtré par compte et `pending` encore vrai ; même transaction (échec : rien n'est supprimé ; `concurrent` : rien n'est supprimé).
7. Réponse `periodSwitch` de l'import : `removedPending` et `remainingPending` (récurrentes encore `pending` datées dans la période close) ; message fr/en. Log `recurring_pending_removed` par id, sans montant ni libellé.
Conservés : `pending` sans `recurringId`, ou sans équivalent.
Cas de test : 7 / 8 jours ; signe contraire ; catégorie nulle ; deux récurrentes même catégorie ; une ligne pour deux pendings ; pending sans recurringId ; déjà rapprochée ; paie importée avec sa pending ; facture du 29 importée avec la paie du 28 ; échec et concurrence : rien supprimé ; saisie simple : rien supprimé ; import sans bascule : rien supprimé.
