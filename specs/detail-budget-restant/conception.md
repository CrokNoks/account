# Conception — reste par catégorie du détail « Budget restant »

## Ce que ça calcule ou décide
Entrées : catégories, budgets, réel par catégorie de la période (celles de `computePeriodForecast`). Sortie : la liste des catégories qui ont encore du budget à dépenser, avec leur reste en centimes, dont la somme vaut `-budgetRemaining` au centime.

## Comparaison des options
| | (a) le back expose le reste du prévu | (b) le front plafonne `BudgetCategoryBreakdown.remaining` |
| --- | --- | --- |
| CA4 | Garanti par construction : même boucle, même variable que `budgetRemaining` | Non garanti : deux appels (stats + répartition), deux fonctions, à garder alignées |
| Remboursement | `expenseRule` : reste = `maxExpenses - spent` = \|budget\| si réel > 0 | À réécrire côté front (le plafond de l'hypothèse ne suffit pas : répartition = \|budget\| + réel, donc il faudrait aussi clamp à \|budget\|, et le sens du virement n'est pas dans `remaining`) |
| Écart entre deux appels | Aucun (même réponse) | Possible |
| Coût | 1 champ dans la réponse stats, ~15 lignes back | Moins de back, mais règle d'argent dupliquée en front |

**Recommandation : (a)**, dans la réponse stats. C'est la plus simple qui garantit CA4, parce que le détail est le sous-total de la boucle qui produit déjà `budgetRemaining`. Aucune règle n'est recopiée.

## L'algorithme
Dans `computePeriodForecast`, aux deux endroits où `budgetRemaining -= maxExpenses - spent` (dépense/épargne et virement sortant) :
1. `left = maxExpenses - spent` (déjà calculé, c'est la même valeur).
2. `budgetRemaining -= left`.
3. Si `left > 0`, `remainingByCategory.push({ categoryId: cat.id, remaining: left })`.
Revenus et virements entrants ne passent pas par ces branches : exclus d'office.

Dans `GetPeriodStatsUseCase` : joindre le nom de la catégorie, trier par `remaining` décroissant, puis par `name` (localeCompare), puis par `categoryId` pour un ordre stable, et exposer :
`budgetRemainingDetail: Array<{ categoryId: string; name: string; remaining: string }>` (centimes, chaînes comme le reste de la réponse, positifs).

Invariant : `Σ remaining = -BigInt(budgetRemaining)`.

## Données et structure
- `functions/src/reporting/domain/period-forecast.ts` : nouveau champ `remainingByCategory` (liste de `{categoryId, remaining: bigint}`), aucune autre règle modifiée.
- `functions/src/reporting/application/get-period-stats.use-case.ts` : jointure des noms, tri, sérialisation. Le tri est fait ici (une seule fois), le front ne trie ni ne filtre.
- `functions/src/reporting/infrastructure/reporting.controller.ts` : DTO Swagger du nouveau champ.
- Rien d'écrit en base, pas de migration. La route de répartition (`get-budget-breakdown`) n'est pas touchée : l'écart « répartition vs prévu » reste connu et documenté.

## Arrondis, limites et cas particuliers
- Centimes entiers (bigint), aucun arrondi, aucun flottant.
- Réel négatif : reste = max(0, \|budget\| + réel). Réel positif (remboursement) : reste = \|budget\|, le remboursement n'ajoute rien. Budget 0 : pas de ligne. Dépassé ou épuisé : pas de ligne.
- Budget lu en valeur absolue (signe parfois négatif en base).
- Sens du virement par `transferDirection` (déjà dans la boucle).
- Égalité de tri : nom (insensible à la casse, `localeCompare`), puis `categoryId`.
- Détail vide ou en erreur alors que budget restant ≠ 0 : avec (a) le détail vient de la même réponse que le chiffre, donc le cas « liste vide avec chiffre non nul » est impossible côté back. Côté front, si le champ est absent (ancien back pendant un déploiement) : la ligne reste affichée mais non cliquable, pas de volet ; une liste vide avec budget restant non nul est traitée de même (jamais de volet vide ni de somme fausse affichée). Pas de nouvel appel, donc pas de cas « erreur de chargement du détail » : le récap ne dépend que des stats.

## Exploitation
- Pas de mesure ni de flag (décisions de la spec). Retour arrière : revert du commit ; champ additif, les anciens clients l'ignorent.
- Log : aucun nouveau log nominal. Si l'invariant est violé (somme ≠ -budgetRemaining), `logger.warn({ event: 'budget_remaining_detail_mismatch', periodId })` sans montant ni nom (ne devrait jamais arriver ; garde-fou d'exploitation, pas une règle).

## Alternative écartée
(b) plafonner `remaining` côté front : deux sources, règle d'argent dupliquée, sens du virement à redécouvrir, écart possible entre deux appels. Écartée pour ces raisons.

## Cas de test qui prouvent que c'est juste
Tests au niveau fonction pure (`period-forecast.spec.ts`) et au niveau use case (jeu de données stats, `get-period-stats.use-case.spec.ts`) ; chacun vérifie aussi `Σ detail = -budgetRemaining`.
| Entrées | Résultat attendu | Pourquoi ce cas |
| --- | --- | --- |
| Dépense budget 100,00, réel -30,00 | ligne 70,00 | cas nominal |
| Dépense budget 100,00, réel +20,00 (remboursement) | ligne 100,00 (pas 120,00) | CA5, `expenseRule` |
| Dépense budget 100,00, réel -130,00 | pas de ligne | dépassement |
| Dépense budget 100,00, réel -100,00 | pas de ligne | épuisée |
| Dépense budget 0, réel -10,00 / réel 0 | pas de ligne | budget 0 |
| Budget stocké négatif (-100,00), réel -30,00 | ligne 70,00 | signe du budget |
| Épargne budget 50,00, réel 0 | ligne 50,00 | épargne incluse |
| Virement sortant (budget -200,00), réel -50,00 | ligne 150,00, comptée dans la somme | CA4 « virements sortants compris » |
| Virement entrant (budget +200,00) | pas de ligne, hors somme | exclu |
| Revenu budget 1000,00, réel 0 | pas de ligne, hors somme | exclu |
| Deux catégories au même reste, noms différents | ordre par nom | égalité de tri |
| Deux catégories même reste et même nom | ordre par `categoryId`, stable | égalité totale |
| Mélange de tous les cas ci-dessus | `Σ = -budgetRemaining` exactement | règle critique |
| Aucun budget restant | liste vide, `budgetRemaining = 0` | CA8 |

## Fichiers de la partie sensible
- `functions/src/reporting/domain/period-forecast.ts` (+ `period-forecast.spec.ts`)
- `functions/src/reporting/application/get-period-stats.use-case.ts` (+ son spec)
- `functions/src/reporting/infrastructure/reporting.controller.ts` (DTO seulement)

## Écart à la spec à valider
La spec listait `get-budget-breakdown.use-case.ts` ; l'option (a) recommandée modifie à la place `period-forecast.ts`, `get-period-stats.use-case.ts` et le contrôleur (stats), et `get-budget-breakdown` reste intact. Côté front, `use-budget-breakdown.ts` n'est plus la source du détail : le détail vient de `usePeriodStats`.

## Non sensible (mode standard)
UI du volet (ligne cliquable, dépli/repli, mobile seulement `lg:`, CA1, CA2, CA6, CA7, CA8), libellés `Dashboard.composition_*` fr/en, type front `PeriodStats` (nouveau champ), tests UI. Dépendent du champ back : à faire après la partie sensible.
