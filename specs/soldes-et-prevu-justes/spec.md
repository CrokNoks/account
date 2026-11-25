# Soldes et prévu justes (lot 2)

## Le problème
Lucas lit trois chiffres faux sur Aujourd'hui. (1) « En banque » et « À venir » d'une période reprennent les CB non pointées et les factures `pending` des périodes finies (le départ prend tout ce qui est daté avant le début). (2) Sur une période active dont la fin est passée, un revenu pointé daté après la fin n'est pas dans « En banque ». (3) Le prévu prend le max (dépensé, budget) sur le total des dépenses : un dépassement est masqué par un budget non consommé.

## Critères d'acceptation
Montants en centimes entiers (exemples en euros). Exemple de référence : voir « Exemples chiffrés ».
- [ ] CA1 — « En banque » = solde initial + transactions pointées datées avant le début + pointées de la période. Une CB non pointée ou une facture `pending` d'une période finie n'y entre plus (exemple A : 2 900 € au lieu de 2 750 €, le relevé dit 2 900 €).
- [ ] CA2 — « À venir » = solde initial + non `pending` datées avant le début + non `pending` de la période. Une CB ancienne non pointée y reste ; une facture `pending` ancienne n'y est pas (exemple A : 2 800 €).
- [ ] CA3 — Le départ du prévu reste « tout ce qui est daté avant le début », `pending` et non pointées comprises : la CB et la facture anciennes restent dues dans le prévu (exemple A : prévu 1 750 €, inchangé).
- [ ] CA4 — Période active dont la fin est passée : un revenu pointé daté après la fin compte dans « En banque » (et dans « À venir », puisqu'une transaction pointée n'est jamais `pending`), sans attendre la période suivante. Le prévu, lui, ne le compte pas (décision de Lucas, fenêtre inchangée). Un revenu non pointé daté après la fin reste ignoré partout (ex. la prochaine paie `pending`). Les dépenses ne changent pas (exemple F : En banque 3 200 €, prévu 1 750 €).
- [ ] CA5 — Dépenses : le prévu prend, pour chaque catégorie de dépense et d'épargne, max(dépensé, |budget|), puis additionne. Un budget négatif vaut sa valeur absolue ; budget 0 ou absent = 0. Un réel net positif (remboursement) laisse le budget entier et s'ajoute au prévu (option B du lot 1, par catégorie).
- [ ] CA6 — Revenus : même règle par catégorie (revenus et virements). Réel ≥ 0 : revenus retenus = max(réel, |budget|). Réel négatif sur une catégorie de revenu : miroir de l'option B, le budget reste entier et le négatif se déduit (retenus = |budget| + réel) ; sur une catégorie de virement (`transfer`) : virement sortant déjà passé, retenu = réel, budget ignoré, rien d'attendu (décision de Lucas, contrôle 2). Puis somme (exemples C et G).
- [ ] CA7 — Composition : en banque + CB + factures + reports + arrivé après la fin + budget restant + revenus attendus = prévu, au centime, dans les exemples A à G. « Reports » = CB non pointées et factures `pending` datées avant le début (exemple A : -150). « Arrivé après la fin » = -(revenus pointés datés après la fin d'une période active), négatif, nul sinon (exemple F : -300) ; il annule ce que « En banque » compte et que le prévu ignore. CB, factures et « À pointer · N » restent ceux de la période. Budget restant et revenus attendus sont calculés par catégorie, avec la même règle que le prévu (revenus attendus = revenus retenus - réel de la catégorie).
- [ ] CA8 — La simulation des budgets donne le même prévu que les stats pour les mêmes budgets ; `expensesEffect` et `incomeEffect` sont les écarts des sommes par catégorie, « Sans effet » reste décidé par côté. Dans l'évolution, `realBankBalance` suit CA1/CA4 ; `forecastBalance` (départ complet + toutes les transactions de la fenêtre) ne change pas.

- [ ] CA9 — Aucune écriture ne produit une transaction à la fois pointée et `pending`. Pointer (simple ou en lot) retire `pending`, comme aujourd'hui (`resolvePending`). Créer, importer ou modifier avec `pending: true` sur une transaction pointée, ou avec les deux à vrai dans le corps, est refusé en 400 sans aucune écriture (en lot : tout ou rien). La bascule de période et les récurrentes générées (`pending`, non pointées) restent conformes.

## Règle critique
L'égalité de la composition au centime (CA7), avec les départs séparés (CA1-CA3), le revenu arrivé après la fin (CA4) et le max par catégorie (CA5-CA6). Test écrit avant le code : sur les exemples A, F et G, banque + lignes = `forecastBalance`.

## Exemples chiffrés
**A. Départs (compte initial 0, P1 fermée, P2 active).** Avant le début de P2 : salaire +2 000 pointé, loyer -800 pointé, CB -60 non pointée, facture électricité -90 `pending`. P2 : salaire +2 000 pointé, courses -300 pointée, restaurant -40 non pointée, loyer -800 `pending`. Budgets P2 : salaire 2 000, courses 400, restaurant 100, loyer 800.

| | Avant | Après |
| --- | --- | --- |
| Départ En banque / À venir / prévu | 1 050 / 1 050 / 1 050 | 1 200 / 1 140 / 1 050 |
| En banque | 2 750 | 2 900 (= relevé) |
| À venir | 2 710 | 2 800 |
| Prévu | 1 750 | 1 750 |

Les reports (CB -60 + facture -90 = -150) sortent de « En banque » et, pour la facture, de « À venir » ; ils restent dans le prévu. Budget restant = -(100 + 60 + 0) = -160.

**B. Max par catégorie, dépenses.** Courses réel -500 / budget 300 ; loyer réel 0 / budget 800. Avant : max(500, 1 100) = 1 100. Après : 500 + 800 = 1 300. Prévu -200 (le dépassement des courses n'est plus masqué).

**C. Max par catégorie, revenus.** Salaire réel 2 000 / budget 2 000 ; prime réel 0 / budget 300 ; freelance réel 400 / budget 0. Avant : max(2 400, 2 300) = 2 400. Après : 2 000 + 300 + 400 = 2 700. Prévu +300. Le prévu monte quand un revenu attendu n'est pas encore arrivé : à valider (voir Hypothèses).

**D. Budget négatif.** Abonnements stocké -200, réel -250 : max(250, 200) = 250, comme avec +200. Réel -150 : 200, comme avec +200.

**E. Remboursement net (option B), par catégorie.** B + loisirs réel +50 / budget 200. Après : dépenses 500 + 800 + 200 = 1 500, remboursement +50, net -1 450. Avant : -1 300 (le remboursement était absorbé par le total des dépenses). Écart -150 = -200 (courses) + 50 (loisirs). Conséquence : un remboursement ne compense plus le dépassement d'une autre catégorie.

**F. Revenu pointé après la fin.** Exemple A + prime +300 pointée datée le 2/12, P2 finissant le 30/11 et restant active. En banque 2 900 + 300 = 3 200 ; À venir 2 800 + 300 = 3 100 ; prévu inchangé 1 750. Composition : 3 200 - 40 - 800 - 150 (reports) - 300 (arrivé après la fin) - 160 + 0 = 1 750.

**G. Revenu à réel négatif (miroir de l'option B).** Salaire budget 2 000, réel -50 (correction) : revenus retenus = 2 000 - 50 = 1 950 (avant, par total : max(-50, 2 000) = 2 000). Revenus attendus de la ligne = 1 950 - (-50) = 2 000. Avec la prime de l'exemple C en plus (0 / 300) : retenus 1 950 + 300 = 2 250.

## Décisions de Lucas (besoin.md, « Décisions de Lucas après le canard »)
1. Lignes non réglées d'une période fermée : option A, ligne « Reports » à part ; CB, Factures et « À pointer · N » restent ceux de la période (exemple A).
2. Revenu pointé après la fin d'une période active : compté dans « En banque », prévu inchangé, ligne de composition « Arrivé après la fin » négative (exemple F).
3. Réel négatif d'une catégorie de revenu : miroir de l'option B (CA6, exemple G) ; d'une catégorie de virement : retenu = réel, budget ignoré (contrôle 2).

## Mesure d'impact
- Indicateur qui doit bouger : écart entre « En banque » affiché et le solde du relevé (cible 0) ; part des périodes dont le prévu change avec la nouvelle règle.
- Équipe qui en profite : Performance (chiffres fiables sans recalcul à la main).
- Comment on le mesure : (1) Lucas compare à la main « En banque » avec son relevé avant/après (réponse 3 du cadrage). (2) Requête en lecture seule `supabase/queries/prevu-par-categorie.sql` : par période, prévu ancien (max sur le total) et nouveau (max par catégorie, miroir côté revenus), part des périodes où ils diffèrent. Choix du cadreur : la requête SQL, pas de log `period_stats_built`. Raison : zéro code en production, elle couvre toutes les périodes d'un coup (le log ne couvre que celles qu'on ouvre) et se lance avant et après. Limite : elle reproduit la formule en SQL ; on la contrôle sur la période de l'exemple A contre les stats. Lancement : `PGOPTIONS='-c default_transaction_read_only=on' psql`, comme `depenses-hors-fenetre.sql`.

## Exploitation
- À voir en prod : erreurs 5xx des stats et de la simulation (la RPC de départ doit toujours remonter son échec, jamais un départ à 0).
- Retour arrière : revert des commits ; la migration n'ajoute qu'une fonction SQL (`DROP FUNCTION`), aucune donnée à corriger.
- Feature flag : non (calcul pur, sans écriture ; vérification par l'exemple A et la requête de mesure avant release).

## Parties sensibles
- Prévu par catégorie (`computePeriodForecast`, `expenseRule`) — algorithme qui touche l'argent.
- Départs séparés et fenêtre de « En banque » / « À venir » — calcul d'argent.
- Composition et égalité au centime — calcul d'argent.

## Ce qui change dans l'existant
- Change la formule du prévu de `docs/reporting.md:33` (max sur le total remplacé par max par catégorie, côté dépenses et côté revenus ; `expenseRule` et l'option B gardées, appliquées par catégorie).
- Change `docs/reporting.md:13-14, 32, 34` : le solde de départ n'est plus unique ; trois départs (pointées, non `pending`, tout). La fenêtre de « En banque » d'une période active n'a plus de borne de fin pour ce qui est pointé.
- Change `docs/reporting.md:60` (composition) : budget restant et revenus attendus par catégorie ; deux lignes ajoutées, « Reports » et « Arrivé après la fin » (7 termes au lieu de 5).
- Nouvelle règle (CA9, décision 1) : `reconciled` et `pending` jamais vrais ensemble. Complète `functions/src/transactions/domain/pending-rule.ts:7-14` (`resolvePending` retire déjà `pending` quand on pointe ; reste à refuser `pending: true` sur une transaction pointée) et `docs/transactions.md` (règle « Modification (simple et en lot) : si `reconciled` est envoyé à vrai, `pending` est remis à faux », ligne 33 ; définition de « En attente », ligne 10 ; filtre d'état, ligne 45 ; pointer / dépointer, ligne 46 : « Pointer une Facture à venir la sort de l'attente »).
- Devient sans sujet : `docs/reporting.md:60` (« une transaction rapprochée (`pending` ou non) n'a pas de ligne propre » : plus de cas `pending` rapprochée) ; `docs/reporting.md:15-16` et la zone d'ombre sur « pointé et pending » ; côté front `operation-state.ts` (« Pointée même si `pending` ») et les commentaires de `stateFilterToQuery` (« envoyer `pending=false` exclurait la pending rapprochée »). Le code peut rester tel quel, aucun comportement ne change ; les commentaires et la doc sont à corriger par le documentaliste.
- Ne change pas, mais précise `docs/reporting.md:34` et la zone d'ombre « un revenu daté après la fin n'y entre pas » : le prévu continue d'ignorer ce revenu ; seule « En banque » (et « À venir ») le compte.
- Change `docs/reporting.md:50` et `docs/periods.md` « Écran Budgets » (« Sans effet ») : `expensesEffect` / `incomeEffect` deviennent des écarts de sommes par catégorie ; le verdict reste par côté.
- Change `docs/reporting.md:38` (évolution) : le départ de `realBankBalance` ne prend que les pointées ; `forecastBalance` inchangé.
- Change `docs/transactions.md:58` : `sum_transactions_before_date` n'est plus la seule source du départ (elle reste pour la trésorerie, `get-cashflow-forecast.use-case.ts:49`).
- Ne change pas : la fenêtre du prévu pour les revenus non pointés (`period-window.ts:26-34`, factures-reservees), le rythme, les dépassements, la trésorerie.

## Fichiers concernés
Schéma géré par fichiers de migration (`supabase/migrations/`, pas de `synchronize`).
- Modifier : `functions/src/reporting/domain/period-forecast.ts` — max par catégorie, `expenseRule` par catégorie, mêmes sorties
- Modifier : `functions/src/reporting/domain/forecast-composition.ts` — budget restant et revenus attendus par catégorie, reports (option A)
- Modifier : `functions/src/reporting/application/load-period-forecast-input.ts` — trois départs, réel de la période
- Modifier : `functions/src/reporting/application/get-period-stats.use-case.ts` — En banque / À venir avec leur départ, fenêtre bancaire, champ reports
- Modifier : `functions/src/reporting/application/get-evolution.use-case.ts` — départ pointé pour `realBankBalance`
- Vérifier (sans doute inchangé) : `functions/src/reporting/application/simulate-period-forecast.use-case.ts` — réutilise le chargement et `computePeriodForecast`
- Modifier : `functions/src/transactions/domain/transaction.repository.interface.ts:69` et `functions/src/transactions/infrastructure/supabase-transaction.repository.ts:214` — nouvelle méthode de départs par solde ; garder `sumAmountByAccountBeforeDate` (trésorerie)
- Créer : `supabase/migrations/<horodatage>_sum_transactions_before_date_by_balance.sql` — fonction SQL (`SECURITY INVOKER`, comme `20261125100100_sum_transactions_before_date_invoker.sql`)
- Créer : `supabase/queries/prevu-par-categorie.sql` — mesure en lecture seule
- Modifier (CA9) : `functions/src/transactions/domain/pending-rule.ts` — refus de `pending: true` avec `reconciled` ; appelants à vérifier : `functions/src/transactions/infrastructure/transactions.controller.ts` (création, import, modification simple et en lot), `application/create-transaction.use-case.ts`, `application/bulk-create-transactions.use-case.ts`, `application/bulk-update-transactions.use-case.ts`, `domain/transaction.entity.ts:91-92`
- Créer (CA9, si la migration le permet) : `supabase/migrations/<horodatage>_transactions_not_reconciled_and_pending.sql` — `CHECK (NOT (reconciled AND pending))`, après contrôle des données existantes (attendu 0 ligne : `select count(*) from transactions where reconciled and pending`, lecture seule) ; contrôler que `apply_period_switches`, `upsert_transactions` et `insert_transactions` n'écrivent jamais cet état
- Tests CA9 : `functions/src/transactions/domain/pending-rule.spec.ts`, `application/bulk-update-transactions.use-case.spec.ts`, `functions/test/transactions.e2e-spec.ts`, `supabase/tests/` (un test SQL de la contrainte, à créer)
- Front (deux lignes en plus dans la composition ; la barre ne s'applique que si reports et arrivé après la fin n'obligent pas aux lignes signées, à fixer par le test) : `frontend/src/features/reporting/model/types.ts`, `model/forecast-composition.ts`, `ui/forecast-composition.tsx`
- Tests (existants, à compléter) : `functions/src/reporting/domain/period-forecast.spec.ts`, `domain/forecast-composition.spec.ts`, `application/get-period-stats.use-case.spec.ts`, `application/simulate-period-forecast.use-case.spec.ts`, `application/get-evolution.use-case.spec.ts`, `functions/src/transactions/infrastructure/supabase-transaction.repository.spec.ts`, `supabase/tests/sum_transactions_before_date_test.sql`, `functions/test/front-contract.e2e-spec.ts` (mock du départ), front `model/forecast-composition.test.ts`, `ui/forecast-composition.test.tsx`
- Vérification réelle : nouveau fichier `functions/http/soldes-et-prevu-justes.http` (Créer, httpYac), exemple A rejoué.

## Hors périmètre
- Reprendre les lignes d'une période fermée dans les lignes de la période en cours (réponse 2).
- Le prévu pour un revenu daté après la fin, pointé ou non (assumé, factures-reservees ; décision 2).
- Rythme de dépense, dépassements, trésorerie, anomalies, répartition du budget.

## Hypothèses
- Les reports restent dus : dans le prévu, et dans « À venir » pour la CB seule. Découle de l'option A de Lucas et de sa réponse 2 du cadrage.
- « À venir » compte aussi un revenu pointé daté après la fin (sinon À venir < En banque). Besoin n°6 ne cite que « En banque ».
- Période fermée : « En banque » reste borné à sa fin ; seule la période active perd la borne pour ce qui est pointé.
- Le prévu par catégorie remonte quand un revenu attendu manque encore (exemple C) : suite logique de « OK (par catégorie) », mais le prévu devient plus optimiste.
- Décision 1 de Lucas : `reconciled` et `pending` ne sont jamais vrais ensemble (0 cas sur 2 735 transactions en prod, vérifié en lecture seule le 2026-11-25). Les calculs ne traitent donc plus d'état « pointé et `pending` » : En banque ⊂ À venir, et la composition n'a pas de cas « rapprochée `pending` ».

## Points ouverts
Aucun. Les trois points de la première version sont tranchés (décisions de Lucas ci-dessus ; mesure : requête SQL, voir « Mesure d'impact »).
