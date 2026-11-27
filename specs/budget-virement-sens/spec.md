# Sens d'un budget de virement (entrant ou sortant)

## Le problème
Le prévu compte tout budget de virement comme un revenu attendu, quel que soit son signe. En prod, « Virement CJ » (virement sortant, budget −2 032,48 €) relève donc le prévu de 2 032,48 € tant qu'il n'est pas parti, pour de l'argent qui va sortir. « Revenus prévus » et « Non réparti » sont faux pour le même motif, et l'écran Budgets réenregistre en positif un budget modifié : la première modification de CJ le transformerait en virement entrant.

## Définition : sens d'une catégorie de virement
- Budget non nul : le signe du budget. Négatif = sortant, positif = entrant (confirmé par Lucas, réponse 1).
- Budget absent ou 0 : réel négatif = sortant, sinon entrant. Sans budget ni opération : entrant (réponse 2).
- Aucune migration : les signes stockés en prod sont déjà justes (CJ : 4 budgets négatifs et défaut −2 032,48 ; Salaire Lucas, Pension invalidité Flo, CAPSSA Flo : tous positifs).
- Les budgets négatifs de catégories qui ne sont pas des virements (dépenses) restent lus en valeur absolue, inchangés.

## Exemples chiffrés (euros ; centimes entiers dans le code)
Prévu, hors solde de départ, par catégorie. « Avant » = règle actuelle.

| Cas | Avant | Après | Écart |
| --- | --- | --- | --- |
| CJ −2 032,48, non parti (réel 0) | +2 032,48 (revenu attendu) | −2 032,48 (dépense retenue) | −4 064,96 |
| CJ parti en entier (réel −2 032,48) | −2 032,48 | −2 032,48 (retenu = max(2 032,48 ; 2 032,48)) | 0 |
| CJ parti en partie (réel −1 000,00) | −1 000,00 | −2 032,48 (le reste, 1 032,48, est encore dû) | −1 032,48 |
| CJ parti plus que prévu (réel −2 100,00) | −2 100,00 | −2 100,00 | 0 |
| Salaire Lucas +2 033,00, pas arrivé | +2 033,00 | +2 033,00 | 0 |
| Salaire Lucas +2 033,00, arrivé (réel +2 033,00) | +2 033,00 | +2 033,00 | 0 |
| Salaire Lucas +2 033,00, revient négatif (réel −50,00) | −50,00 (budget ignoré) | −50,00 (décision 1) | 0 |

Totaux de l'écran Budgets (Salaire Lucas 2 033,00 ; CJ −2 032,48 ; dépenses budgétées 500,00) :
- Avant : Revenus prévus 4 065,48 ; Total budgété 500,00 ; Non réparti +3 565,48.
- Après : Revenus prévus 2 033,00 ; Total budgété 2 532,48 ; Non réparti −499,48.

Composition du prévu, CJ non parti : −2 032,48 passe de « revenus attendus » (+) à « budget restant » (−). La somme des 7 lignes reste égale au prévu, au centime.

## Critères d'acceptation
- [ ] CA1 — Étant donné « Virement CJ » budgété −2 032,48 € et pas encore parti, quand on lit le prévu de la période, alors il baisse de 2 032,48 € par rapport au même compte sans budget CJ (et de 4 064,96 € par rapport à l'affichage d'avant). Parti en entier ou plus : même prévu qu'avant. Parti en partie (−1 000,00 €) : le reste dû (1 032,48 €) reste dans le prévu.
- [ ] CA2 — Les virements entrants (Salaire Lucas +2 033,00 €, pas arrivé ou arrivé) donnent le même prévu qu'avant, et sont comptés comme un revenu attendu tant qu'ils ne sont pas arrivés.
- [ ] CA3 — Dans la composition du prévu, un virement sortant non parti compte dans « budget restant » et plus dans « revenus attendus » ; l'égalité des 7 lignes tient au centime (cas CJ non parti, parti en partie, Salaire arrivé).
- [ ] CA4 — La simulation donne le même prévu que les stats pour les mêmes budgets, y compris un budget de virement négatif ; « Sans effet » se décide par côté en rangeant chaque virement du côté de son sens (modifier CJ agit sur le côté dépenses).
- [ ] CA5 — Écran Budgets, cartes : avec CJ budgété, « Total budgété » l'inclut (2 032,48 €), « Revenus prévus » ne l'inclut plus, « Non réparti » = Revenus prévus − Total budgété (exemple : −499,48 €). Un virement entrant reste dans « Revenus prévus ».
- [ ] CA6 — Écran Budgets, tableaux : un virement sortant apparaît dans « Dépenses », classé comme une dépense (consommation, reste négatif = dépassement) ; un virement entrant apparaît dans « Revenus » (colonnes Réel et Budget, sans « Reste », comme un revenu) ; un virement sans budget ni opération est dans « Revenus ».
- [ ] CA7 — Écran Budgets, saisie : la saisie applique le sens connu de la catégorie (signe du budget enregistré, à défaut signe du réel ; « entrant » seulement sans budget ni opération). Exemples : CJ budgété −2 032,48 €, taper `2100,00` enregistre −2 100,00 € ; CJ sans budget cette période mais avec des sorties (réel −2 032,48 €), taper `2100,00` enregistre −2 100,00 € ; CJ budget remis à 0 puis `2100,00` ressaisi : −2 100,00 € (le réel négatif donne le sens) ; une catégorie de virement sans budget ni opération, `500,00` : +500,00 €. Retaper la valeur affichée n'est pas un changement. Un montant négatif tapé (`-500`) est accepté pour une catégorie de virement et en fait un sortant ; pour toute autre catégorie il reste refusé comme aujourd'hui.
- [ ] CA9 — Rythme de dépense (Aujourd'hui) : la ligne « Budget » garde sa valeur d'avant, hors virements (CJ −2 032,48 € budgété ne la change pas) ; les stats exposent pour cela un champ de plus.
- [ ] CA8 — Montants par défaut (`/budgets/fixed`) et création de période : le signe d'un virement est gardé (défaut CJ −2 032,48 € proposé tel quel, enregistré négatif s'il est modifié en `2100,00`, même règle de saisie que CA7 : sens du défaut enregistré, à défaut signe du réel) ; la bascule du déclencheur copie déjà les défauts avec leur signe, le comportement est conservé.

## Règle critique
Pour un virement de sens sortant, le prévu retient max(dépensé, |budget|) comme une dépense : CJ −2 032,48 € non parti ne relève jamais le prévu, il le baisse de 2 032,48 €. Test écrit avant le code sur les lignes CJ du tableau ci-dessus, avec l'égalité de la composition. Règle écrite une seule fois (`computePeriodForecast`), réutilisée par les stats, la composition et la simulation.

## Mesure d'impact
- Indicateur qui doit bouger : écart du prévu dû aux budgets de virement ; « Non réparti » et « Revenus prévus » justes pour un compte avec virement sortant budgété.
- Équipe qui en profite : Performance (chiffres fiables sans recalcul à la main).
- Comment on le mesure : (1) Lucas vérifie sur l'écran Budgets, période active, que CJ non parti fait baisser le prévu (−4 064,96 € par rapport à avant, −2 032,48 € par rapport à sans CJ). (2) Requête lecture seule `supabase/queries/prevu-virements-sens.sql` (à créer, même forme que `prevu-par-categorie.sql`) : par période, prévu hors départ avec l'ancienne règle et avec la règle du sens, limité aux catégories de virement à budget non nul, écart et part des périodes qui changent. Contrôle : sur la période active avec CJ non parti, écart attendu −4 064,96 €.

## Exploitation
- À voir en prod : erreurs 5xx des stats, de la simulation et de l'enregistrement des budgets.
- Retour arrière : revert des commits ; aucune donnée à corriger (aucune écriture de migration).
- Feature flag : non (calcul pur, sans migration). Livrer le back et le front dans la même release : un ancien front enregistrerait CJ en positif.

## Parties sensibles
- Prévu par catégorie de virement (`computePeriodForecast`, règle du sens) — algorithme qui touche l'argent.
- Composition à 7 termes (budget restant / revenus attendus) — calcul d'argent.
- Totaux prévus (`plannedIncome`, `plannedExpenses`) et « Non réparti » — calcul d'argent.

## Ce qui change dans l'existant
- Change la règle « virement sortant réel < 0 : retenu = réel, budget ignoré » de `docs/reporting.md` (règle du prévu, décision v4.2.0) : pour un virement de budget négatif, retenu = max(dépensé, |budget|). Le résultat ne change que si 0 < |réel| < |budget| (CJ parti en partie). Budget positif, nul ou absent : règle d'avant (décision 1 de Lucas).
- Change `docs/reporting.md` : « Budget = toujours valeur absolue » (virements : le signe porte le sens), `plannedIncome` / `plannedExpenses` (virements rangés par sens), composition (budget restant inclut les virements sortants ; revenus attendus les entrants), répartition du budget (reste et % d'un virement sortant calculés comme une dépense).
- Change `docs/budgets.md` : « Signe d'un budget », cartes « Revenus prévus » et « Total budgété », « Non réparti » (virements comptés par sens), note et zone d'ombre sur le tableau « Dépenses » et le sens d'un virement (écart tableau/carte supprimé).
- Change `docs/periods.md` : saisie de l'écran Budgets (« une valeur modifiée est enregistrée en positif ») et ligne équivalente de `/budgets/fixed` et de la création de période.
- Ne change pas : fenêtre de période, trois soldes de départ, `expenseRule`, option B, règles de revenu.

## Chemins qui exposent le budget d'un virement
| Chemin | Décision |
| --- | --- |
| Stats (prévu, `plannedIncome`, `plannedExpenses`, composition) | Couvert : CA1 à CA3, CA5 |
| Simulation | Couvert : CA4 |
| Répartition du budget (écran Budgets) | Couvert : CA6 |
| Brouillon de période, création, bascule, `/budgets/fixed` | Couvert : CA8 |
| Enregistrement des budgets (`PUT …/budgets`) | Couvert : CA7 (signe envoyé tel quel, aucun refus côté API) |
| Rythme de dépense, ligne « Budget » d'Aujourd'hui (`plannedExpenses`) | Couvert : CA9 (décision 2) |
| Dépassements et Répartition d'Analyses, « Budgets variables » et À traiter d'Aujourd'hui (catégories de dépense et d'épargne seulement) | Hors périmètre : un virement n'y est pas, avant comme après |
| Évolution (réel seul), trésorerie et calendrier (récurrentes), anomalies | Sans budget : inchangés |

## Fichiers concernés
Schéma géré par fichiers de migration (`supabase/migrations/`) ; aucune migration ici.
- À modifier : `functions/src/reporting/domain/period-forecast.ts` — sens d'un virement, aiguillage vers `expenseRule` ou `incomeRule`, totaux prévus par sens
- À modifier : `functions/src/reporting/domain/forecast-composition.ts` — à vérifier, doit reprendre `computePeriodForecast`
- À modifier : `functions/src/reporting/application/get-budget-breakdown.use-case.ts:74-93` — reste et % d'un virement sortant
- À modifier : `frontend/src/features/budgets/model/sort-budget-lines.ts:54-61` — virement sortant classé avec les dépenses, entrant avec les revenus
- À modifier : `frontend/src/features/budgets/model/budget-draft.ts` — saisie qui garde le sens, négatif accepté pour un virement (la saisie doit connaître les catégories de virement)
- À modifier : `frontend/src/features/budgets/ui/budgets-screen.tsx:205,221-222` — sections, « Sans effet » par sens
- À modifier : `frontend/src/features/periods/ui/budget-templates-form.tsx`, `create-period-dialog.tsx` — même saisie ; `functions/src/periods/application/get-budget-templates.use-case.ts` et le brouillon (`draft-init`) ne renvoient pas le type de catégorie : à ajouter ou à lire ailleurs
- À créer : `supabase/queries/prevu-virements-sens.sql` — mesure (Glob : absent)
- Tests : `functions/src/reporting/domain/period-forecast.spec.ts`, `domain/forecast-composition.spec.ts`, `application/get-budget-breakdown.use-case.spec.ts`, `application/simulate-period-forecast.use-case.spec.ts` ; front `budget-draft.test.ts`, `sort-budget-lines.test.ts`, `budgets-screen.test.tsx`, `budget-templates-form.test.tsx`, `create-period-dialog.test.tsx`
- Vérification réelle : nouveau `functions/http/budget-virement-sens.http` (httpYac)

## Hors périmètre
- Dépassements et Répartition d'Analyses pour un virement sortant (voir tableau des chemins).
- Passer un virement de sortant à entrant par la saisie (seul un montant négatif tapé change le sens, vers sortant).
- Interdire côté API un budget négatif hors virement.

## Hypothèses
- Un virement sortant dont le réel est positif (virement reçu dans une catégorie sortante) est un remboursement, comme pour une dépense (`expenseRule`).
- Totaux bruts `realIncome` / `realExpenses` inchangés (virements dans les revenus) : ils ne sont lus par aucun écran (Glob/Grep du front).
- Écran Budgets : un virement sortant affiche un reste négatif comme une dépense ; Aujourd'hui et Analyses ne l'affichent pas (écart, voir tableau).
- Un montant négatif tapé sur un virement qui a déjà un budget positif le rend sortant (la décision 3 ne le dit pas).

## Décisions de Lucas (`besoin.md`, « Décision 1 »)
1. Virement entrant qui revient négatif (budget positif, réel < 0) : retenu = réel, budget ignoré (règle actuelle conservée). Salaire Lucas +2 033,00 €, réel −50,00 € : −50,00 €, rien d'attendu.
2. Ligne « Budget » du rythme de dépense : valeur d'avant, hors virements, avec un champ de plus dans les stats (CA9).
3. Saisie d'un budget de virement : sens connu (signe du budget enregistré, à défaut signe du réel) ; entrant par défaut seulement sans budget ni opération (CA7).
