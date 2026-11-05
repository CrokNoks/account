# Conception — Calcul des dépassements par période

## Ce que ça calcule ou décide
Pour UNE période fermée : catégories, budgets de la période, transactions de la période → pour chaque catégorie, son dépassement en centimes (`bigint`, 0 si aucun) ; la liste ne garde les dépassements > 0, le graphique garde la valeur (0 inclus). Une seule fonction pour les deux.

## Fichiers de la partie sensible (le mode standard n'y touche pas)
- `functions/src/reporting/domain/category-overrun.ts` (créé) : fonction pure, aucune dépendance Nest/repo.
- `functions/src/reporting/domain/category-overrun.spec.ts` (créé) : cas de test ci-dessous.

Écart avec la spec : elle place la fonction dans `get-overruns-by-period.use-case.ts`. Je la sors dans `domain/` pour que Lucas relise un seul fichier de moins de 150 lignes et que le graphique n'importe pas un cas d'usage. Les deux cas d'usage (`get-overruns-by-period`, `get-category-overruns-chart`), contrôleur, module, front restent « standard » ; ils dépendent de la signature ci-dessous (mode `implementation` si le standard a besoin de la fonction réelle).

## Signature
```ts
export interface OverrunCategory { id: string; type: CategoryType }
export interface OverrunTransaction { categoryId: string | null; amount: bigint; pending: boolean }
export interface CategoryOverrun {
  categoryId: string;
  budget: bigint;   // valeur absolue, 0n si pas de budget
  real: bigint;     // somme signée hors pending
  overrun: bigint;  // >= 0n
}

// Une période. `transactions` = déjà filtrées par dates de la période.
export function computeOverrunsForPeriod(
  categories: OverrunCategory[],
  budgetByCategory: Map<string, bigint>,  // amountAllocated, signe quelconque
  transactions: OverrunTransaction[],
): CategoryOverrun[]            // une entrée par catégorie dépense/épargne, ordre de `categories`

export function computeOverrun(type: CategoryType, budget: bigint, real: bigint): bigint
```
Sortie : une entrée pour chaque catégorie EXPENSE/SAVINGS (revenus et virements absents). La liste filtre `overrun > 0n` ; le graphique prend l'entrée de la catégorie (budget 0 et overrun 0n si absente du Map).

## L'algorithme
`computeOverrun(type, budget, real)` :
1. si `type` n'est ni EXPENSE ni SAVINGS → `0n`
2. `limit = |budget|` ; si `limit === 0n` → `0n`
3. si `real >= 0n` → `0n` (remboursements nets : décision de Lucas)
4. `excess = -real - limit` ; retourne `excess > 0n ? excess : 0n` (égalité = 0)

`computeOverrunsForPeriod` :
1. `real` par catégorie : somme de `amount` des transactions avec `categoryId` non nul et `pending === false` (BigInt, jamais Number).
2. pour chaque catégorie EXPENSE/SAVINGS : `budget = |budgetByCategory.get(id) ?? 0n|`, `real = realMap.get(id) ?? 0n`, `overrun = computeOverrun(...)`.

Le rattachement des transactions à la période se fait dans le cas d'usage, comme la répartition : `findAllByAccountUnpaginated(accountId, { startDate, endDate })` (bornes incluses), jamais par `period_id`. La fonction ne regarde ni dates ni `period_id`.

## Données et structure
Fonction pure : lit ses 3 arguments, n'écrit rien. Le cas d'usage liste appelle la fonction par période fermée (`isActive === false`, tri par date de début décroissant) ; le graphique l'appelle pour chaque période fermée de P1 à P2 (tri croissant). Aucun flottant ; sérialisation en string côté cas d'usage (comme la répartition).

## Arrondis, limites et cas particuliers
- Centimes entiers, aucun arrondi. Montants bigint.
- Priorité : type → budget 0 → signe du réel → comparaison stricte.
- Budget de signe quelconque : seule `|budget|` compte. Budget absent = 0.
- Transaction dont `period_id` ≠ sa date : on se fie aux dates (cas d'usage), testé au niveau cas d'usage (voir ci-dessous).
- Plage d'une seule barre (P1 = P2, ou une seule période fermée) : une période, une barre, pas d'erreur (cas d'usage graphique).
- Catégorie budgétée dans certaines périodes seulement : période sans budget → budget 0, dépassement 0, barre présente.
- Hors fonction (cas d'usage) : P1 après P2 refusé, P1/P2 non fermées ou d'un autre compte refusés comme le reporting.

## Exploitation
Pas de log dans la fonction pure. Les cas d'usage loguent `overruns_report_built` et `overruns_chart_built` (spec), sans montant ni libellé. Retour arrière : revert, lecture seule.

## Alternative écartée
Réutiliser `GetBudgetBreakdownUseCase` et filtrer `remaining < 0` : plus simple, mais il compte les pending, inclut les budgets à 0 et le reste = `|budget| + réel` donne les mêmes signes seulement par hasard pour les revenus ; la spec exige une règle différente et un seul calcul explicite.

## Cas de test qui prouvent que c'est juste
Écrits avant le code, dans `category-overrun.spec.ts` sauf mention « UC » (spec du cas d'usage). B = budget, R = réel, centimes.

| Entrées | Résultat attendu | Pourquoi ce cas |
| --- | --- | --- |
| EXPENSE, B=10000, R=-12000 | 2000n | cas nominal |
| EXPENSE, B=10000, R=-10000 | 0n | égalité exacte : pas de dépassement |
| EXPENSE, B=10000, R=-10001 | 1n | borne juste au-dessus |
| EXPENSE, B=10000, R=-9999 | 0n | borne juste en dessous |
| EXPENSE, B=-10000, R=-12000 | 2000n | budget négatif = valeur absolue |
| EXPENSE, B=10000 ou -10000, mêmes R | même résultat | signe du budget sans effet |
| SAVINGS, B=5000, R=-8000 | 3000n | épargne comptée comme dépense |
| EXPENSE, B=0, R=-5000 | 0n | CA3 budget 0 |
| EXPENSE, budget absent du Map, R=-5000 | 0n (budget 0) | CA3 sans budget |
| INCOME, B=10000, R=+15000 et R=-15000 | absente / 0n | CA4 revenu jamais |
| TRANSFER, B=10000, R=-15000 | absente / 0n | CA4 virement jamais |
| EXPENSE, B=10000, R=+3000 | 0n | remboursements nets : réel positif |
| EXPENSE, B=10000, R=0 (aucune transaction) | 0n | catégorie sans mouvement |
| EXPENSE, B=10000, tx -8000 non pending + tx -5000 pending | R=-8000, 0n | CA5 pending exclue |
| EXPENSE, B=10000, tx -12000 pending seule | R=0, 0n | CA5 dépasse seulement grâce au pending |
| EXPENSE, B=10000, tx -15000 et remboursement +6000 | R=-9000, 0n | remboursement en déduction |
| EXPENSE, B=10000, tx -15000 et remboursement +2000 | R=-13000, 3000n | remboursement partiel |
| tx sans categoryId | ignorée | comme la répartition |
| montants > 2^53 (ex. B=9007199254740993n, R=-9007199254740995n) | 2n exact | pas de flottant |
| 2 catégories dont 1 INCOME | seule l'EXPENSE sort, ordre de `categories` conservé | filtre de type au niveau période |
| UC liste : période active + 2 fermées | seules les fermées, la plus récente en premier | CA1 |
| UC liste : aucune période fermée / aucun dépassement | liste vide (le front affiche le message) | CA7 |
| UC liste : tx dont `period_id` = P_A mais date dans P_B | comptée dans P_B (dates) | rattachement par dates |
| UC graphique : P1 = P2 | 1 barre | plage d'une barre |
| UC graphique : une seule période fermée | 1 barre | idem |
| UC graphique : catégorie budgétée en P1 et P3, pas en P2 | 3 barres ; P2 budget 0, dépassement 0 | budgétée certaines périodes seulement |
| UC graphique : période sans dépassement | barre présente, dépassement 0 | CA7 |
| UC graphique : budget en valeur absolue, barres en ordre chronologique | conforme | CA6 |
| UC graphique : P1 après P2 | refus (erreur), pas de permutation | décision de Lucas |
| UC graphique : même catégorie/période, liste vs graphique | dépassement identique | une seule fonction (CA6) |
| UC : période d'un autre compte | refus comme la répartition (`ensureBelongsToAccount`) | CA8 |
