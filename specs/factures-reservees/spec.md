# Spec — factures-reservees

Mode complet. Sources : `besoin.md` (conception validée par Lucas, « go » du 2026-11-24, non rouverte), `docs/reporting.md`, `docs/periods.md`, `docs/budgets.md`, code de `functions/src/reporting/`.

## Objectif
Une dépense déjà saisie est une somme réservée : elle ne doit jamais ressortir comme disponible dans le prévu parce que sa date dépasse la fin de la période active. Aujourd'hui, tout ce qui est daté après la fin est ignoré (`load-period-forecast-input.ts:52-56`), donc le prévu, les budgets, l'évolution et les alertes présentent cette somme comme libre.

## Ce que ça change dans l'existant
- **Change la règle « Rattachement des transactions à la période : par dates, début et fin incluses »** de `docs/reporting.md` (l.53), pour la **période active** et pour les **dépenses** seulement (stats, simulation, répartition, évolution, anomalies). Les dépassements (périodes fermées seules) ne sont pas touchés.
- **Change la règle « Période d'analyse des anomalies »** (`docs/reporting.md` l.47) : une période active avec fin ne s'arrête plus à sa fin pour les dépenses.
- Ne change ni les formules de `docs/reporting.md` l.32 (prévu), l.33 (En banque, À venir), l.59 (composition), ni le solde de départ (l.31).

## Règle de fenêtre (définition commune)
Une transaction compte dans une période si sa date est ≥ au début **et** si l'une de ces conditions est vraie : la période n'a pas de fin ; la date est ≤ à la fin ; **la période est active et le montant est strictement négatif (une dépense)**.
Dépense = montant < 0, quelle que soit la catégorie ou l'absence de catégorie (`besoin.md`, précisions). La fin estimée (`estimatedEndDate`) ne borne rien : le back ne la lit nulle part dans les calculs.

## Critères d'acceptation

1. **Prévu : la dépense réservée y est.** Sur une période active, toute dépense datée depuis son début, avant, le jour de ou après sa fin, entre dans le prévu (`forecastBalance`), le réel par catégorie et les sans-catégorie. Vaut aussi pour une période active dont la fin est déjà dépassée (elle reste active : rien ne la clôt à une date, `periods.controller.ts:225`, et elle ne cesse donc pas de compter les dépenses saisies après sa fin).
2. **En banque et À venir gardent leurs définitions.** Une dépense future `pending` n'entre ni dans En banque ni dans À venir (elle est dans « Factures à venir » de la composition). Une CB non `pending`, non rapprochée, datée après la fin entre dans À venir et dans « CB non pointées », pas dans En banque. Une dépense rapprochée, datée après la fin, entre dans En banque et dans À venir (si non `pending`). Valeurs attendues : table de la règle critique.
3. **Composition = prévu au centime.** Pour tout jeu de transactions, banque + CB non pointées + factures à venir + budget restant + revenus attendus = `forecastBalance`, y compris avec des dépenses après la fin.
4. **Simulation = stats.** Sur la même période active, la simulation avec les budgets enregistrés renvoie le même `forecastBalance` que les stats et le même réel (`realExpenses`, `realIncome`), dépenses après la fin comprises.
5. **Budgets et évolution comptent la même dépense.** La répartition (réel, reste, %) et la comparaison de périodes incluent la dépense datée après la fin de la période active. L'évolution la compte dans le prévisionnel et les dépenses réelles de cette période. Pour une période active, la somme des réels « dépenses + épargne » de la répartition (sans catégorie exclue, comme aujourd'hui) = `realExpenses` des stats = `realExpenses` de l'évolution.
6. **Alertes : même fenêtre que le prévu.** Un doublon ou une dépense inhabituelle datée après la fin d'une période active est détecté pour cette période, ainsi qu'une dépense future d'une période active sans fin (aujourd'hui coupée à la date du jour).
7. **Ce qui reste borné.** (a) Période fermée : une dépense datée après sa fin n'y est pas comptée. (b) Revenu ou montant positif daté après la fin d'une période active : non compté (donc ni dans le prévu, ni dans En banque, ni dans À venir). (c) Rythme de dépense : inchangé, il s'arrête à la fin ou à aujourd'hui.
8. **Pas de double compte à la clôture.** Quand une période suivante est créée, l'ancienne passe inactive dans la même opération (`docs/periods.md` l.19) et retrouve sa fin comme borne : dans le cas courant (la période active est la plus récente), une dépense n'est comptée que dans une période. Le cas du point ouvert 2 n'est pas couvert. Les périodes ne se chevauchent pas (`docs/periods.md` l.101) et une seule est active (l.104).

## Règle critique (test écrit avant le code)
**La règle de fenêtre ci-dessus, en centimes entiers (`bigint`), pour une même liste de transactions partagée par le prévu, la composition, la simulation, la répartition, l'évolution et les alertes.** Le test écrit avant le code est la table de cas, plus l'égalité de la composition avec le prévu.

Base de la table : période active du 2026-11-01 au 2026-11-30, solde de départ 100 000 (1 000,00 €), aucun budget, une dépense de −12 000 (−120,00 €). Les effets sont ceux de cette dépense sur la période, par rapport à « avant ». Aujourd'hui : 2026-11-24.

| # | Période | Opération (−12 000 sauf mention) | Comptée ? | Prévu | En banque | À venir | Ligne de composition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | active avec fin | `pending`, datée 05/12 (après la fin), catégorisée | oui (nouveau) | −12 000 | 0 | 0 | factures −12 000 |
| 2 | active avec fin | CB non `pending`, non rapprochée, 05/12 | oui (nouveau) | −12 000 | 0 | −12 000 | CB −12 000, +1 |
| 3 | active avec fin | non `pending`, rapprochée, 05/12 | oui (nouveau) | −12 000 | −12 000 | −12 000 | aucune (déjà en banque) |
| 4 | active avec fin | `pending` et rapprochée, 05/12 | oui (nouveau) | −12 000 | −12 000 | 0 | aucune |
| 5 | active avec fin | sans catégorie, `pending`, 05/12 | oui (nouveau) | −12 000 (via sans-catégorie ; réel par catégorie inchangé) | 0 | 0 | factures −12 000 |
| 6 | active avec fin | datée le 30/11 (jour de la fin) | oui (déjà) | −12 000 | selon statut | selon statut | selon statut |
| 7 | active avec fin | datée avant la fin (15/11) | oui (déjà) | −12 000 | selon statut | selon statut | selon statut |
| 8 | active avec fin | datée avant le début (31/10) | non : va dans le solde de départ | inchangé par la fenêtre : le solde de départ contient déjà −12 000, une seule fois | idem | idem | aucune |
| 9 | active avec fin | revenu +12 000, 05/12 | non (borné, `besoin.md` n°7) | 0 | 0 | 0 | aucune |
| 10 | active avec fin | remboursement +12 000 sur catégorie de dépense, 05/12 | non (montant positif) | 0 | 0 | 0 | aucune |
| 11 | active, fin dépassée (fin 30/11, aujourd'hui 05/12) | `pending`, 03/12 | oui (comme 1) | −12 000 | 0 | 0 | factures −12 000 |
| 12 | active sans fin | `pending`, toute date ≥ début | oui (déjà) | −12 000 | 0 | 0 | factures −12 000 |
| 13 | fermée (fin 30/11) | dépense datée 05/12, quel que soit son statut | non (garde sa borne) | 0 | 0 | 0 | aucune |
| 14 | fermée | dépense datée ≤ 30/11 | oui (déjà) | −12 000 | selon statut | selon statut | selon statut |

« Selon statut » = comme les lignes 1 à 4 : `pending` hors En banque et À venir, CB non rapprochée dans À venir, rapprochée dans En banque.

Cas chiffré de l'égalité (catégories de dépense « Courses » et « Loyer », budget Courses 40 000, Loyer sans budget, départ 100 000) :
- Courses −30 000 rapprochée (10/11), CB −5 000 non rapprochée (20/11) sur Courses, facture `pending` Loyer −12 000 datée 05/12.
- Avant : réel −35 000, budget 40 000, prévu 100 000 − 40 000 = **60 000** ; composition 70 000 − 5 000 − 5 000 (budget restant) = 60 000.
- Après : réel −47 000, budget 40 000, prévu 100 000 − 47 000 = **53 000** ; composition : banque 70 000, CB −5 000, factures −12 000, budget restant 0, revenus attendus 0, soit 53 000. En banque reste 70 000 ; À venir reste 65 000 (la facture `pending` n'y est pas).
- Une dépense qui tient dans un budget non consommé ne baisse pas le prévu : elle déplace la somme de « budget restant » vers « factures à venir » (prévu inchangé, mais plus de budget restant).

## Mesure d'impact
- Indicateur : nombre de dépenses (montant < 0) datées après la fin d'une période active et absentes de son prévu. Cible : 0.
- Mesure : requête sur la recette, comparant les dépenses datées après la fin de la période active à celles que comptent les stats. Au 2026-11-24, elle renvoie déjà 0 opération concernée (`besoin.md`) : l'indicateur ne bougera donc pas à la livraison, il garde le comportement. La preuve est le test de la règle critique et une dépense de contrôle créée en recette (datée après la fin, vue dans le prévu puis supprimée).
- Un critère n'est « livré ✅ » que vu en réel, application lancée en recette.

## Exploitation
- Retour arrière : `git revert` des commits du cycle (calculs en lecture seule, aucune donnée écrite).
- Pas de feature flag : aucune écriture, aucun schéma modifié ; le chiffre revient à l'ancien dès le revert.
- Pas de migration : le projet gère son schéma par `supabase/migrations/`, et ce cycle n'y touche pas.
- Surveillance : le prévu d'une période active peut baisser à la livraison si des dépenses futures existent (aucune en recette au 2026-11-24, à revérifier en prod avant release).

## Parties sensibles
- **Calcul qui touche l'argent** : la fenêtre de période appliquée au prévu, aux soldes à venir et à la composition (skill `point-de-controle`). La conception est déjà validée par Lucas (« go ») ; le code est à lui montrer avant le commit.
- Pas de concurrence ni de nouvelle brique d'architecture.

## Chemins d'exposition
Pas de règle de droit d'accès ajoutée (toutes les routes sont sous `SupabaseAuthGuard`, RLS inchangée, `docs/reporting.md` « Ce qu'on peut faire »). Chemins qui exposent un total ou une liste de période :

| Chemin | Source | Statut |
| --- | --- | --- |
| Stats (prévu, En banque, À venir, composition ; aussi les soldes en tête d'Opérations, lus de ces stats) | `load-period-forecast-input.ts:52-56`, `get-period-stats.use-case.ts:78-87` | Couvert (1 à 3) |
| Simulation du prévu | `simulate-period-forecast.use-case.ts:52` (même chargement que les stats) | Couvert (4) |
| Répartition du budget (écran Budgets, Budgets variables, À traiter « dépassement en cours ») | `get-budget-breakdown.use-case.ts:50-54` | Couvert (5) |
| Comparaison de périodes | réutilise la répartition (`get-period-comparison.use-case.ts:35-39`) | Couvert (5), sans code propre |
| Évolution | `get-evolution.use-case.ts:66-70` | Couvert (5) |
| Anomalies | `get-anomalies.use-case.ts:41,50-53` | Couvert (6) |
| Rythme de dépense | `get-spending-pace.use-case.ts:59-61` | Hors périmètre, dit dans `besoin.md` n°6 |
| Dépassements (liste, graphique, grille) | `period-overruns.ts:33` (périodes fermées seules) | Inchangé |
| Calendrier, trésorerie, Échéances, bloc Factures | filtrés par date, pas par période | Inchangé |
| Détail d'un tag | `get-tag-details.use-case.ts:66` | Point ouvert 1 |
| Liste d'Opérations filtrée par période | `transactions.controller.ts:448` | Point ouvert 1 |

## Hypothèses
- **Une seule période active par compte** : réponse du code, index unique `periods_one_active_per_account` (`docs/periods.md` l.104-105). La règle ne peut donc pas viser deux périodes à la fois.
- **Période active sans fin** : le prévu n'a déjà pas de borne, revenus compris (`load-period-forecast-input.ts:55`) ; inchangé. L'API ne crée pas de période ouverte (`docs/periods.md` l.38). Pour les anomalies, ce cas change : « même fenêtre que le prévu » (`besoin.md` n°5), donc plus d'arrêt à aujourd'hui. Des périodes ouvertes existent en base.
- **Solde de départ inchangé** : toutes les transactions avant le début, `pending` comprises (`docs/reporting.md` l.31). Une dépense datée dans l'écart entre deux périodes n'est dans aucune fenêtre ; elle entre dans le départ de la période suivante. Pas de double compte.
- **Remboursement après la fin** : un montant positif daté après la fin reste borné (`besoin.md`). Une dépense et son remboursement datés tous deux après la fin laissent donc la dépense seule dans le prévu. Conséquence assumée de la décision 7.
- **Virement négatif** : une catégorie de virement est comptée comme revenu par le prévu ; un virement négatif daté après la fin est une « dépense » (montant < 0) et entre dans cette catégorie, sans traitement à part.
- **« Prévu le {fin} »** : le libellé garde la date de fin de la période ; le chiffre inclut désormais les dépenses datées après. Pas de changement de texte dans ce cycle.
- Les dépenses déjà comptées avant la fin gardent leur effet exact : seules les dépenses datées après la fin d'une période active sont nouvelles.

## Points ouverts (décisions de Lucas)
1. **Opérations et détail d'un tag restent bornés à la fin de la période.** Conséquence : la dépense datée après la fin compte dans le prévu et, si c'est une CB non rapprochée, dans « CB à pointer » de À traiter ; mais le lien « CB à pointer » ouvre Opérations sur la période (`/transactions?state=a_pointer`) et ne la montre pas, et le détail d'un tag l'ignore. Proposition : appliquer la même fenêtre à la liste d'Opérations de la période active, pour que le lien montre ce qui est compté. Hors du « go » donné, donc non fait sans accord.
2. **Période active qui n'est pas la plus récente.** Réactiver une période ancienne par PATCH est possible si aucune autre n'est active (`docs/periods.md` l.53). Sa fenêtre sans fin recouvrirait alors des périodes fermées plus récentes : une dépense compterait deux fois d'une période à l'autre. Proposition : pour une période active suivie d'une autre, borner à la veille du début de la suivante. À trancher ; le cas courant (active = la plus récente) n'est pas concerné.

## Hors périmètre
- Rythme de dépense, revenus futurs, dépassements des périodes fermées, trésorerie et calendrier (voir tableau).
- Changement de définition de `pending`, d'En banque ou d'À venir.
- Texte de l'interface.

## Fichiers concernés
Chemins vérifiés par Glob. Le schéma n'est pas touché : pas de migration.

À modifier (back) :
- `functions/src/reporting/application/load-period-forecast-input.ts` : fenêtre du réel, partagé par les stats et la simulation.
- `functions/src/reporting/application/get-budget-breakdown.use-case.ts` : fenêtre de la répartition (et donc de la comparaison).
- `functions/src/reporting/application/get-evolution.use-case.ts` : fenêtre de l'évolution (filtre aux l.66-70).
- `functions/src/reporting/application/get-anomalies.use-case.ts` : fenêtre des anomalies (l.41, 50-53).
- Tests existants à compléter : `get-period-stats.use-case.spec.ts`, `simulate-period-forecast.use-case.spec.ts`, `forecast-composition.spec.ts`, `get-budget-breakdown.use-case.spec.ts`, `get-evolution.use-case.spec.ts`, `get-anomalies.use-case.spec.ts` (même dossier).

À créer (Glob : absents) :
- `functions/src/reporting/domain/period-window.ts` et `period-window.spec.ts` : la règle de fenêtre en un seul endroit, avec la table de cas (le test d'abord).
- `functions/http/factures-reservees.http` : scénario réel httpYac (période active, dépense après la fin, stats, simulation, répartition).
- `supabase/queries/depenses-hors-fenetre.sql` : requête de mesure (dossier existant, un fichier voisin : `depassements-par-periode.sql`).

À réutiliser sans modifier : `functions/src/reporting/domain/period-forecast.ts`, `functions/src/reporting/domain/forecast-composition.ts` (formules inchangées).

Selon la décision du point ouvert 1 : `functions/src/transactions/infrastructure/transactions.controller.ts` (l.448), `functions/src/reporting/application/get-tag-details.use-case.ts` (l.66).

Après le cycle : `docs/reporting.md` (règles l.35, 37, 47, 53, 59), par le documentaliste. Front : aucune modification prévue.
