# Rattachement des transactions à la période par les dates seulement

## Le problème
Une transaction est rattachée à une période de deux façons qui divergent : par sa date (reporting, liste) et par `period_id` (trigger, bascule, suppression). Résultat : une exception « revenu pointé tardif » et une ligne « Arrivé après la fin » pour réconcilier les deux, une suppression de période qui ne retrouve pas les bonnes factures si on modifie une transaction, un tag et un rythme de dépense qui ne suivent pas la fenêtre du prévu.

## Critères d'acceptation
- [ ] CA1 — Période **fermée** : seules les transactions datées de [début, fin] comptent (prévu, En banque, À venir, répartition, évolution, anomalies, liste Opérations, détail d'un tag). Ajouter ou redater une transaction dans une période fermée change ses chiffres au rechargement, sans autre action.
- [ ] CA2 — Période **active** : toute transaction datée à partir du début compte, dépense **ou revenu**, pointé ou non ; sa date de fin n'est qu'indicative. Une période active sans catégorie déclencheuse (ou sans fin) fonctionne de même, jusqu'à sa clôture à la main.
- [ ] CA3 — **Seule exclusion** de la fenêtre active : la prochaine paie, c'est-à-dire une transaction `pending`, de la catégorie déclencheuse du compte, portant un `recurringId`, datée **strictement après** la fin de la période. Une paie pointée, une paie sans `recurringId` ou une paie `pending` datée dans la période comptent.
- [ ] CA4 — La ligne « Arrivé après la fin » disparaît de la composition (réponse stats et écran) ; la composition reste égale au prévu au centime, y compris avec un revenu pointé daté après la fin d'une période active. Un tel revenu entre dans En banque, À venir et le prévu.
- [ ] CA5 — Le détail d'un tag d'une période active compte les transactions taguées datées après la fin (hors prochaine paie), comme le prévu.
- [ ] CA6 — Rythme de dépense d'une période active dont la fin est dépassée : la courbe continue jusqu'à aujourd'hui avec les nouvelles dépenses ; une période fermée s'arrête à sa fin (inchangé).
- [ ] CA7 — Supprimer une période retire ses factures `pending` issues d'une récurrente (`source = recurring`) **choisies par leur date** : période fermée = datées de [début, fin] ; période active = datées à partir du début, **prochaine paie comprise**. Rien d'autre n'est supprimé (pointée, saisie, importée). L'aperçu annonce les mêmes nombres.
- [ ] CA8 — Annuler une bascule (supprimer la période ouverte par le déclencheur) supprime ses récurrentes `pending` et sa prochaine paie (datée au lendemain de sa fin), rouvre la période précédente avec sa fin d'avant, et les transactions conservées y apparaissent par leurs dates (aucun déplacement).

## Règle critique
La **fenêtre d'une période** (CA1 à CA3), écrite une seule fois et appliquée partout. Test écrit avant le code : table de cas sur `isInPeriodWindow` (fermée aux bornes ; active avec revenu non pointé et pointé après la fin ; prochaine paie exclue vs paie pointée / sans `recurringId` / datée dans la période ; période active sans fin) + un cas chiffré où composition = prévu avec un revenu tardif pointé.

## Mesure d'impact
- Indicateur : écart entre la composition et le prévu (attendu 0) ; prévu avant/après identique pour toute période sans revenu daté après sa fin.
- Équipe : Performance (moins de règles, chiffres qui se recalculent seuls).
- Mesure : requête SQL lecture seule dans `supabase/queries/` rejouée sur les vraies données avant, puis après : prévu par période (ancienne fenêtre vs nouvelle), et liste des périodes dont le prévu change (attendu : celles avec un revenu daté après leur fin, et elles seules).

## Exploitation
- À voir en prod : log de suppression `period_deleted` (`removedPending`, `keptTransactions`) inchangé ; comparer son nombre à l'aperçu.
- Retour arrière (la colonne est supprimée, donc un simple revert ne suffit plus). Script `supabase/queries/rattachement-par-dates-retour.sql`, écrit avec la migration et rejoué sur base locale avant la mise en prod. Démarche, dans l'ordre :
  1. Recréer la colonne : `ALTER TABLE transactions ADD COLUMN period_id uuid REFERENCES periods(id) ON DELETE SET NULL;` + son index (`20251229111000_add_period_id_to_expenses.sql:3-5`).
  2. Recalculer par les dates (même règle que l'ancien rattachement, `20261125100000_period_trigger.sql:205-214` : l'active n'a pas de borne de fin, la prochaine paie lui revient ; une seule période par ligne, `periods_no_overlap` et l'active est la dernière) : `UPDATE transactions t SET period_id = p.id FROM periods p WHERE p.account_id = t.account_id AND t.date >= p.start_date AND (p.end_date IS NULL OR t.date <= p.end_date OR p.is_active);` Les lignes hors de toute période restent vides, comme avant.
  3. Rejouer les définitions d'avant des fonctions et du trigger modifiés par la migration (`CREATE OR REPLACE` depuis leurs migrations d'origine : trigger `set_transactions_period_id` `20261101100100_remove_savings_goals.sql:53-70`, `apply_period_switches` `20261125100000_period_trigger.sql`, `delete_period_clean` / `period_deletion_plan` `20261126110100_delete_period_clean.sql`, et les autres fonctions touchées).
  4. Seulement ensuite, redéployer l'ancien back puis l'ancien front.
  Ce qui n'est pas restauré : rien, `period_id` se déduit des dates (aucune information perdue). Les requêtes de mesure « avant » se lancent **avant** la migration.
- Ordre de déploiement : (1) back, qui accepte et ignore encore `periodId` ; (2) migration (un back ancien écrirait `period_id` dans une colonne disparue) ; (3) front. Entre (1) et (2), l'ancienne base tourne sans souci : le back n'envoie plus `period_id`, les fonctions SQL lisent NULL.
- Feature flag : non (calcul partagé, pas de moitié de chemin possible).

## Parties sensibles
- Fenêtre de période et composition du prévu : calcul qui touche l'argent. Point de contrôle sur la conception (CA1 à CA4) puis sur le code.
- Règle de choix des `pending` à supprimer (CA7, CA8) : suppression de données par date. Rangée en critère, pas en partie sensible.

## Ce qui change dans l'existant
- `docs/reporting.md` : règle « Rattachement des transactions à la période » (l.63, deux règles remplacées par une) ; vocabulaire « Fenêtre » (l.11) ; « Revenu pointé tardif / Arrivé après la fin » (l.27) ; règle En banque/À venir (l.43) ; « Composition » (l.25, l.69 : 7 lignes → 6) ; « Détail d'un tag » (l.54) ; « Rythme de dépense » (l.71, l.99 : « ne suit pas la fenêtre ») ; anomalies (l.57 : les revenus ne sont plus bornés à la fin d'une période active) ; évolution (l.47) ; l.151.
- `docs/periods.md` : trigger `assign_period_id` (l.42) et `ON DELETE SET NULL` (l.43) ; bascule : rattachement (l.139), `period_id` de l'import (l.138), prochaine paie « rattachée par `period_id` » (l.134) ; suppression (l.168-170).
- `docs/transactions.md` l.80-89, l.156 : mentions de `period_id`.
- Change le comportement : un revenu non pointé daté après la fin d'une période active compte désormais (avant : ignoré partout).
- Conséquence assumée : une `pending` récurrente datée avant le début de toute période ou entre deux périodes n'est plus supprimée avec une période (elle ne l'était que par `period_id`).

## Fichiers concernés
- À modifier : `functions/src/reporting/domain/period-window.ts` — une seule fenêtre ; retrait de `isLateReconciledIncome`, `periodLoadEndDate` à revoir
- À modifier : `functions/src/reporting/domain/forecast-composition.ts` — 6 lignes, plus d'`arrivedAfterEnd`
- À modifier : `functions/src/reporting/application/load-period-forecast-input.ts`, `get-period-stats.use-case.ts`, `get-evolution.use-case.ts`, `get-budget-breakdown.use-case.ts`, `get-anomalies.use-case.ts` — fenêtre, plus de revenu tardif
- À modifier : `functions/src/reporting/application/get-tag-details.use-case.ts` (CA5), `get-spending-pace.use-case.ts` (CA6)
- À modifier : `functions/src/reporting/infrastructure/reporting.controller.ts` — champ `arrivedAfterEnd` retiré de la réponse
- À modifier : `functions/src/transactions/infrastructure/supabase-transaction.repository.ts` (`applyPeriodWindow`, `findAllByPeriod`), `transactions.controller.ts:516-531` — liste Opérations, même fenêtre
- À modifier : `functions/src/periods/application/apply-period-switch.service.ts`, `functions/src/periods/domain/period-switch.ts`, `functions/src/periods/infrastructure/supabase-period.repository.ts` — plus de `period_id` posé
- À modifier : `functions/src/transactions/application/create-transaction.use-case.ts`, `infrastructure/transaction-payload.ts:13`, `domain/transaction.entity.ts`, `infrastructure/supabase-transaction.repository.ts:30,428` (ligne lue), `transactions.controller.ts:85,280,621,762` — `periodId` retiré (corps : `IgnoredLegacyField`)
- À modifier : `functions/src/shared/application/account-references.service.ts`, `functions/src/transactions/domain/transaction.repository.interface.ts`, `functions/src/budgets/**` — seulement si un usage de `transactions.period_id` y est trouvé (le `period_id` des budgets reste) ; à vérifier par grep à la conception
- À réécrire par dates : `supabase/queries/depassements-par-periode.sql`, `prevu-virements-sens.sql`, `prevu-par-categorie.sql` ; `supabase/seed.sql` ; tests SQL `period_trigger_test.sql`, `delete_period_test.sql`, `security_definer_search_path_test.sql`
- Front à modifier aussi : `frontend/src/features/transactions/model/types.ts:5,19`, `api/use-bulk-create-transactions.ts:9`, `app/[locale]/(dashboard)/transactions/import/page.tsx` ; tests `transaction-list.test.tsx`, `operation-state-label.test.tsx`, `anomaly-badges.test.tsx`, `page.test.tsx`
- La migration couvre aussi : `DROP COLUMN` (FK, index et trigger partent avec), fonctions réécrites sans `period_id` (`apply_period_switches`, `period_deletion_plan`, `delete_period_clean`, `upsert_transactions` / `update_transactions`, création de virement et d'import en lot : `20261030100000`, `20261030100300`, `20261030100400`, redéfinies depuis par `20261127100000_security_definer_search_path.sql`)
- À modifier : `frontend/src/features/reporting/model/forecast-composition.ts`, `model/types.ts`, `frontend/messages/{fr,en}.json` (`composition_arrived`), `frontend/src/features/transactions/ui/create-transaction-drawer.tsx`, `api/use-create-transaction.ts`
- À créer : migration `supabase/migrations/{horodatage}_rattachement_par_dates.sql` — retire le trigger `set_transactions_period_id` / `assign_period_id`, le rattachement de `apply_period_switches`, réécrit `period_deletion_plan`, `delete_period_clean`. Le projet gère le schéma par migrations datées dans ce dossier.
- À créer : requête de mesure `supabase/queries/rattachement-par-dates.sql` et script de retour arrière `supabase/queries/rattachement-par-dates-retour.sql` (voir Exploitation)
- Tests à modifier : `period-window.spec.ts`, `forecast-composition.spec.ts`, `get-period-stats.use-case.spec.ts`, `get-evolution.use-case.spec.ts`, `get-spending-pace.use-case.spec.ts`, `get-tag-details.use-case.spec.ts`, `get-anomalies.use-case.spec.ts`, `forecast-composition.test.ts(x)`, `dashboard-stats.test.tsx`, `supabase/tests/delete_period_test.sql`, `supabase/tests/period_trigger_test.sql`, `functions/test/periods-deletion.e2e-spec.ts` ; réel : `functions/http/suppression-periode-propre.http`, `soldes-et-prevu-justes.http`

## Hors périmètre
- Aucun signal à l'écran pour une période active dont la fin est dépassée (décision de Lucas : un compte épargne n'a besoin que d'une seule période ouverte).
- Le paramètre `periodId` de **filtre** de la liste Opérations (`FindTransactionsQueryDto`) reste : c'est le choix de période, pas le champ de la transaction.
- Dépassements des périodes fermées, trésorerie, calendrier : inchangés (déjà par dates ou hors fenêtre).
- Règles de bascule (seuil 15 jours, dates, règle A) inchangées.

## Hypothèses
- La prochaine paie se reconnaît à : `pending`, catégorie = déclencheuse du compte, `metadata.recurringId` présent, date > fin de la période (code : prochaine paie créée avec `recurringId` et `dueDate`, `period-switch.ts:437-459`). Pas de condition sur le signe du montant (la bascule ne crée que des paies positives).
- Période active **sans fin** ou sans catégorie déclencheuse : rien à exclure.
- La colonne `period_id` des transactions est supprimée (décision de Lucas), avec le trigger, la FK et l'index. `period_id` des **budgets** (`budget_instances`) reste.
- Un client qui envoie encore `periodId` dans le corps d'une transaction (front en cache) : accepté et ignoré, pas de 400. Le projet rejette par défaut tout champ inconnu (`route-id.pipe.ts:35-36`, `forbidNonWhitelisted`), mais a déjà ce cas avec `IgnoredLegacyField` (`accounts/infrastructure/ignored-legacy-field.decorator.ts`, utilisé `accounts.controller.ts:46,71`) : même décorateur sur les corps de création et de modification de transaction (`transactions.controller.ts:85,621`). La réponse n'a plus de `periodId` (`:280`, `:762`).
- « Conservées » de l'aperçu de suppression = transactions de la même fenêtre moins celles supprimées.
- Mesure : pas de revenu non pointé tardif en prod connu ; la requête le dira.

## Points ouverts
Aucun.
