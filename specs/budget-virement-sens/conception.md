# Conception — sens d'un budget de virement

Base : 4204d48 (spec : 0b89d8f). Montants en centimes (bigint côté back, texte JSON ; `BigInt` côté front). Aucun code écrit.

## 0. Principe : une règle, côté back seulement

`transferDirection(budget, real)` : fonction pure dans `functions/src/reporting/domain/transfer-direction.ts` (8 lignes).

```
budget != 0 -> budget < 0 ? 'outgoing' : 'incoming'
sinon       -> real  < 0 ? 'outgoing' : 'incoming'   // sans budget ni opération : incoming
```

Le back l'appelle partout (prévu, répartition, brouillon de période, montants fixes) et **expose le résultat** (`direction`) au front. Le front ne recalcule jamais le sens : il lit `direction`. Il n'y a donc qu'une règle, pas de règle miroir à tenir en phase.

Alternative rejetée : même règle recopiée dans le front (`sort-budget-lines`, `budget-draft`) avec tests miroirs. Plus de code, deux endroits à garder identiques, et le front n'a pas toujours le réel (brouillon).

Champ ajouté (additif, un ancien front l'ignore) : `direction?: 'outgoing' | 'incoming'`, présent seulement sur les catégories de type virement. Il remplace aussi le « type de catégorie à exposer » : sa présence dit « c'est un virement » (le brouillon n'envoie pas `type` aujourd'hui alors que le type front le déclare, écart noté).

## 1. Prévu par catégorie (`period-forecast.ts`) — SENSIBLE

**Ce que ça calcule** : pour un virement, aiguille vers `expenseRule` (sortant) ou `incomeRule` (entrant), selon `transferDirection(budget signé, réel)`.

```
pour chaque catégorie:
  budgetSigné = budget?.amount ?? 0 ; |b| = abs(budgetSigné)
  si type INCOME                -> incomeRule(réel, |b|, false)       // inchangé
  si type TRANSFER:
     realIncome += réel          // inchangé (totaux bruts, non lus par un écran)
     si outgoing -> expenseRule(réel, |b|) : plannedExpenses += |b| ; maxAbsExpenses += retenu ;
                    refundSurplus += remboursement ; budgetRemaining -= (retenu - dépensé)
     si incoming -> incomeRule(réel, |b|, true) : plannedIncome += |b| ; maxIncome += retenu ; expectedIncome += attendu
  sinon (dépense, épargne)      -> expenseRule, inchangé (budget lu en valeur absolue)
```

- Pas de nouvelle règle de calcul : `expenseRule` et `incomeRule` sont réutilisées telles quelles. Seul l'aiguillage est neuf. Le paramètre `isTransfer` de `incomeRule` reste (décision 1 : entrant qui revient négatif = réel, budget ignoré).
- Sortant sans budget (budget 0, réel < 0) : `expenseRule` donne retenu = dépensé, soit le résultat d'avant. Sortant à réel > 0 : remboursement (hypothèse de la spec).
- **Nouveau champ `plannedExpensesExTransfers`** (CA9) : Σ |budget| des seules catégories dépense et épargne (= l'ancien `plannedExpenses`, qui ne contenait pas les virements). Calculé dans `computePeriodForecast`, ajouté à `get-period-stats.use-case.ts` + DTO du contrôleur ; `spending-pace.tsx` le lit à la place de `plannedExpenses`.
- `plannedIncome` / `plannedExpenses` : virements rangés par sens. Revenus prévus = revenus + entrants ; Total budgété = dépenses + épargne + sortants ; Non réparti reste `plannedIncome - plannedExpenses` (front, `unallocated.ts`, inchangé).

**Alternative rejetée** : traiter un virement sortant comme une dépense en changeant son `type` en base. Migration, et le type « virement » sert ailleurs (doubles côtés, soldes).

**Exploitation** : log existant des stats, plus un log `debug` par virement dont le sens vient du réel : `{event:'transfer_direction', categoryId, direction, source:'budget'|'real'|'default'}` (sans montant ni nom). Retour arrière : revert, aucune donnée touchée.

### Cas de test (tableau pour `period-forecast.spec.ts`, euros ; départ 0)

| # | Budget | Réel | Prévu attendu | Pourquoi |
| --- | --- | --- | --- | --- |
| 1 | −2 032,48 | 0 | −2 032,48 | CA1, CJ non parti ; −4 064,96 vs avant (+2 032,48) |
| 2 | −2 032,48 | −2 032,48 | −2 032,48 | parti en entier : inchangé |
| 3 | −2 032,48 | −1 000,00 | −2 032,48 | parti en partie : reste dû 1 032,48 |
| 4 | −2 032,48 | −2 100,00 | −2 100,00 | parti en plus |
| 5 | +2 033,00 | 0 | +2 033,00 | CA2, entrant attendu |
| 6 | +2 033,00 | +2 033,00 | +2 033,00 | arrivé |
| 7 | +2 033,00 | −50,00 | −50,00 | décision 1 : budget ignoré |
| 8 | absent | −500,00 | −500,00 | sortant sans budget : comme avant |
| 9 | 0 | −500,00 | −500,00 | budget remis à 0 : sens par le réel |
| 10 | −2 032,48 | +300,00 | −1 732,48 | sortant à réel positif : remboursement (budget entier retenu + 300) |
| 11 | absent | 0 | 0 | ni budget ni opération : entrant, rien |
| 12 | −2 032,48 CJ + 2 033,00 Salaire + dépense 500 (réel 0) | | −500 −2 032,48 + 2 033,00 = −499,48 | mélange ; `plannedIncome` 2 033,00, `plannedExpenses` 2 532,48, `plannedExpensesExTransfers` 500,00 |

Chaque ligne 1 à 12 vérifie aussi l'égalité de la composition (partie 2). Test 1 écrit en premier, vu rouge.

## 2. Composition à 7 termes (`forecast-composition.ts`) — SENSIBLE (vérification, probablement zéro ligne de logique)

`computeForecastComposition` ne fait que relayer `budgetRemaining` et `expectedIncome` de `computePeriodForecast`. Pour un sortant : contribution au prévu = −retenu + remboursement = réel − (retenu − dépensé), soit réel + terme de `budgetRemaining`. Pour un entrant : retenu = réel + attendu. L'égalité tient donc par construction. On ne change que le commentaire d'en-tête et on ajoute le test : pour chacune des lignes 1 à 12, `banque + CB + factures + reports + arrivé après la fin + budgetRemaining + expectedIncome = forecastBalance`, à l'égalité stricte (bigint). Cas CA3 : CJ non parti (−2 032,48 dans `budgetRemaining`, 0 dans `expectedIncome`), CJ parti en partie, Salaire arrivé.

## 3. Simulation (`simulate-period-forecast.use-case.ts`) — SENSIBLE (par héritage, aucun code à écrire)

Elle appelle `computePeriodForecast` pour le brouillon et pour l'enregistré. `incomeEffect = Δ maxIncome` et `expensesEffect = −Δ maxAbsExpenses` suivent donc le sens automatiquement : modifier CJ agit sur `expensesEffect`. Test de parité (CA4) : pour un jeu de budgets avec CJ négatif, `simulate(budgets enregistrés).forecastBalance == stats.forecastBalance` et `plannedIncome` / `plannedExpenses` identiques.
Côté front (`budgets-screen.tsx:205`, « Sans effet ») : `touches(income)` s'appuie sur `isIncome` de la ligne ; `isIncome` vient maintenant de `direction` (partie 5), donc un sortant est du côté dépenses. Limite connue, acceptée : si le texte tapé change le sens (négatif sur un entrant budgété), la ligne reste rangée du côté enregistré pour « Sans effet ».

Cas de test : CJ −2 032,48 modifié en −2 100,00 non parti : `expensesEffect = −6 752` (−(2 100,00−2 032,48) = −67,52 € soit `−6752`), `incomeEffect = 0`. CJ modifié à −1 000,00 avec réel −1 500,00 : les deux effets 0 (le côté dépenses « Sans effet »). Salaire +2 033,00 → +2 500,00 : `incomeEffect = +46700`, `expensesEffect = 0`.

## 4. Répartition du budget (`get-budget-breakdown.use-case.ts`)

Pour chaque virement : `direction = transferDirection(budget, real)`, ajouté à l'item. Sortant : `remaining = |budget| + real` et `percentage` inversé, exactement comme `EXPENSE` ; entrant : `|budget| − real` comme un revenu. Les listes de la réponse gardent la clé `transfers` (pas de changement de forme), la répartition entre sections se fait au front par `direction`.
Cas : CJ −2 032,48 réel 0 → reste 2 032,48, 0 % ; réel −2 100,00 → reste −67,52 (dépassement) ; Salaire +2 033,00 réel +2 033,00 → reste 0 ; sans budget ni opération → `incoming`.

## 5. Écran Budgets : sections et tri (non sensible)

`sort-budget-lines.ts` : un virement `outgoing` rejoint `spending` (trié par consommation avec dépenses et épargne, `isIncome:false`, `isRevenue:false`) ; un `incoming` rejoint `income` trié par nom (`isIncome:true`, `isRevenue:true`, donc colonnes Réel et Budget sans « Reste »). Plus de branche « virement hors revenus ». `direction` absent sur une ligne de virement (ancien back) : traité comme `incoming`.
Cas : liste mêlée dépenses + CJ sortant + Salaire entrant + virement vide : CJ dans « Dépenses » à sa place de consommation, Salaire et le virement vide dans « Revenus » par nom ; CJ dépassé affiche « dépassement ».

## 6. Saisie qui garde le sens (`budget-draft.ts`) — SENSIBLE (écrit un signe d'argent en base)

Les fonctions reçoivent un paramètre de plus : `directions: Record<categoryId, 'outgoing'|'incoming'>`, construit par l'appelant depuis les `direction` du back (écran Budgets : `breakdown.transfers`; brouillon de période : `categoriesWithStats`; montants fixes : lignes). Une catégorie absente de la table n'est pas un virement.

```
signé(catégorie, texte):                 // utilisé par buildBudgets
  c = parse(texte) ; si c == 0 -> 0
  si pas virement : c  (négatif refusé par draftErrors, comme aujourd'hui)
  si c < 0        : c          // négatif tapé accepté : sortant
  sinon           : direction == outgoing ? -c : c
changedDrafts : un texte n'est pas un changement si c == |enregistré| ou c == enregistré
                (ou, pour un virement sortant sans budget enregistré, c == 0)
draftErrors   : 'negative' seulement hors virement
displayValue  : inchangé (valeur absolue ; le sens est donné par la section « Dépenses »/« Revenus »)
```

Un budget saisi en négatif sur un virement qui a un budget positif : il devient sortant (hypothèse de la spec). Le sens ne sort que du back : après enregistrement, `direction` suit le nouveau signe.
Alternative rejetée : afficher le signe dans le champ (« −2 032,48 »). Ça change la saisie de tous les virements et casse « retaper la valeur affichée » ; la section suffit.

| Cas | Entrée | Enregistré |
| --- | --- | --- |
| CJ budgété −2 032,48, `2100,00` | direction outgoing | −210000 |
| CJ sans budget, réel −2 032,48, `2100,00` (petit cas du canard) | outgoing par le réel | −210000 |
| CJ budget remis à 0 puis `2100,00` ressaisi | outgoing par le réel | −210000 |
| virement sans budget ni opération, `500,00` | incoming | +50000 |
| CJ, retaper `2032,48` | pas un changement | budget −203248 renvoyé tel quel |
| CJ, `-500` | négatif accepté | −50000 |
| catégorie de dépense, `-500` | erreur `negative` | pas d'envoi |
| Salaire +2 033,00, `-100` | accepté | −10000 (devient sortant) |
| CJ champ vidé | 0 | 0 (l'API ne l'enregistre pas) |

## 7. Montants par défaut : `/budgets/fixed`, brouillon, création, bascule

- Brouillon (`get-period-draft.use-case.ts`) : `direction = transferDirection(default signé, avgReal)` pour les virements (le défaut par catégorie est le seul « budget » connu ; à défaut on prend le signe de la moyenne du réel, 0 → entrant). Le défaut CJ −2 032,48 est proposé tel quel (`defaultAllocated` garde son signe, `displayValue` affiche la valeur absolue). La création envoie `buildBudgets` (partie 6).
- Montants fixes (`get-budget-templates.use-case.ts`) : ajoute `direction` pour les virements, `transferDirection(montant proposé signé, 0)` : le proposé (somme des récurrentes) est déjà signé. Même `buildBudgets` dans `budget-templates-form.tsx`.
- Bascule du déclencheur : copie les défauts avec leur signe, rien à changer (vérifié par `.http`).

## 8. Ordre des commits, compatibilité, retour arrière

1. **Sensible** : `transfer-direction.ts`, `period-forecast.ts` (aiguillage + `plannedExpensesExTransfers`), commentaire de `forecast-composition.ts`, stats + DTO, tests 1 à 12, composition, simulation. `docs/reporting.md` en fin (documentaliste).
2. **Non sensible, dépend de 1** : `direction` dans la répartition (reste et % d'un sortant), brouillon et montants fixes ; front : types, `sort-budget-lines`, `budgets-screen` (sections, « Sans effet »), `spending-pace` (nouveau champ), tests.
3. **Sensible** : `budget-draft.ts` + câblage des trois formulaires (écran Budgets, création, `/budgets/fixed`), tests du tableau 6.

Hors incréments : `supabase/queries/prevu-virements-sens.sql` et `functions/http/budget-virement-sens.http` (fixup sur le commit de la fonctionnalité qu'ils vérifient). Seul le SQL est indépendant du code : il peut partir en mode `standard` tout de suite ; tout le reste dépend du commit 1.

- **Ordre de déploiement** : back et front dans la même release (hosting + functions). Un ancien front ne lit pas `direction` et réenregistrerait CJ en positif au premier changement ; un nouveau front sur ancien back range tout en entrant (pas de `direction`) et n'écrit rien de faux, mais n'est pas un état voulu. Le back accepte déjà les deux signes : aucun refus à ajouter.
- **Retour arrière** : revert des commits. Les budgets enregistrés pendant ce temps avec un signe négatif restent lus en valeur absolue par l'ancien code ; aucune donnée à corriger.
- **Mesure** : `prevu-virements-sens.sql`, lecture seule, même forme que `prevu-par-categorie.sql` : par période, prévu hors départ avec l'ancienne règle et la règle du sens, catégories de virement à budget non nul seulement, écart et part des périodes qui changent ; contrôle −4 064,96 € sur la période active (je l'exécuterai avant de la donner).

## Points à trancher par Lucas

1. **Le sens est calculé par le back seulement et exposé en `direction`** (le front ne recalcule rien). OK, ou règle miroir côté front ?
2. **`budget-draft.ts` est-il sensible ?** Je le traite comme tel (il écrit le signe d'un montant) ; il n'est pas dans la liste de la spec.
3. **Brouillon de période** : sens par défaut = signe du défaut enregistré, sinon signe de la moyenne du réel (`avgReal`) de l'historique, sinon entrant. La spec dit « signe du réel » sans dire lequel pour une période qui n'existe pas encore : valable ?
4. **Valeur du champ** : on garde la valeur absolue (le sens se lit à la section). Garder, ou afficher le signe pour un sortant ?
5. **« Sans effet » quand la saisie change le sens** (négatif sur un entrant budgété) : ligne rangée du côté enregistré, limite acceptée ?
6. **`realIncome` / `realExpenses`** : les virements restent dans `realIncome` quel que soit le sens (non lus par un écran). OK.
7. Nom du champ de stats : `plannedExpensesExTransfers`. OK ?

## Validé par Lucas (contrôle 1, 2026-11-27 : « Go ») ; prime sur ce qui précède
1. Sens calculé par le back seul, exposé en `direction` ; pas de règle miroir côté front.
2. `budget-draft.ts` traité comme partie sensible (il écrit le signe d'un montant).
3. Brouillon d'une période non créée : sens = signe du montant par défaut, à défaut signe de la moyenne du réel historique, à défaut « entrant ».
4. Champ de saisie en valeur absolue ; le sens se lit à la section (Dépenses / Revenus).
5. Limite acceptée : « Sans effet » range la ligne du côté enregistré tant que le sens changé par la saisie n'est pas enregistré.
6. Les virements restent dans `realIncome` quel que soit leur sens (aucun écran ne l'affiche).
7. Nouveau champ de stats : `plannedExpensesExTransfers`.
8. Avant le code : expliquer l'écart mesuré en prod (lecture seule, 2026-11-27) : 3 périodes closes (2025-12-14, 2026-01-09, 2026-02-10) changent de −2 032,48 € chacune, alors qu'un CJ non parti donnerait −4 064,96 € ; contrôler la requête contre les stats d'une vraie période et soumettre l'explication à Lucas au contrôle 2.

## Validé par Lucas (contrôle 2, 2026-11-27 : « Commit »)
Code validé ; commits faits par l'orchestrateur. Budgets doublés de « Virement CJ » (−4 064,96 €) sur les 3 périodes closes 2025-12-14, 2026-01-09, 2026-02-10 : laissés tels quels (leur prévu historique baisse de 2 032,48 € chacune).
