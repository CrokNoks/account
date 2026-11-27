# Détail du budget restant dans le récap prévu (mobile)

## Le problème
Sur mobile, le récap « Composition du prévu » affiche une ligne « Budget restant » sans dire d'où vient le chiffre. Pour le comprendre, Lucas doit quitter l'accueil et ouvrir l'écran Budgets.

## Critères d'acceptation
- [ ] CA1 — Étant donné le récap prévu sur mobile et un budget restant non nul, quand j'ouvre l'accueil, alors la ligne « Budget restant » est cliquable et le détail est masqué.
- [ ] CA2 — Quand je touche la ligne, alors un volet se déplie sous elle : une ligne par catégorie qui a encore du budget à dépenser, avec son reste. Un second toucher le replie.
- [ ] CA3 — Les lignes sont triées du plus gros reste au plus petit.
- [ ] CA4 — La somme des restes affichés est égale, au centime, au montant de « Budget restant » (virements sortants compris).
- [ ] CA5 — Une catégorie dépassée, épuisée, ou dont le budget est à 0 n'a pas de ligne ; un remboursement sur une catégorie ne gonfle pas son reste au-delà de son budget.
- [ ] CA6 — Le volet marche dans les deux présentations du récap (barre et lignes signées).
- [ ] CA7 — Sur bureau, le récap ne change pas : « Budget restant » n'est pas cliquable, aucun volet.
- [ ] CA8 — Un budget restant à 0 : la ligne n'est pas cliquable.

## Règle critique
La somme des restes par catégorie affichés = `budgetRemaining` des stats (en valeur absolue), au centime, quelle que soit la période (remboursement, virement sortant, dépassement). Testée avant le code, sur le même jeu de données que les stats.

## Mesure d'impact
- Indicateur qui doit bouger : compréhension du prévu sans quitter l'accueil.
- Équipe qui en profite : Performance.
- Comment on le mesure : pas de mesure (décision de Lucas : aucun outil de log front, pas de brique ajoutée pour ce volet).

## Exploitation
- Ce qu'on doit pouvoir voir en prod : une erreur de chargement du détail n'empêche pas l'affichage du récap.
- Retour arrière : revert du commit front ; aucune donnée touchée.
- Feature flag : non (ajout masqué par défaut, mobile seulement).

## Parties sensibles
- Reste par catégorie du détail : calcul qui touche l'argent. Il doit coïncider avec la règle du prévu (`expenseRule`) ; une divergence afficherait un détail qui ne somme pas au chiffre du dessus.

## Ce qui change dans l'existant
Aucune règle de `docs/reporting.md` n'est modifiée. Écart à connaître : le « reste » de la répartition du budget (`docs/reporting.md`, règle « Répartition budget ») n'est pas celui du prévu quand le réel est positif (remboursement). Répartition : reste = |budget| + réel (`get-budget-breakdown.use-case.ts:99`). Prévu : le budget entier reste à dépenser, le remboursement s'ajoute à part (`period-forecast.ts:74-83`, `:163`, `:175`). Le détail suit le prévu, pas la répartition.

## Fichiers concernés
- À modifier : `frontend/src/features/reporting/ui/forecast-composition.tsx` — ligne « Budget restant » cliquable et volet, mobile seulement (classes `lg:` déjà utilisées dans ce fichier)
- À modifier : `frontend/src/features/reporting/model/forecast-composition.ts` — éventuel modèle du détail (tri, filtre)
- À modifier : `frontend/src/features/reporting/model/types.ts` — types si la réponse du back change
- À modifier : `frontend/messages/fr.json`, `frontend/messages/en.json` — libellés du volet (clés `Dashboard.composition_*`)
- À modifier : `functions/src/reporting/application/get-budget-breakdown.use-case.ts` — seulement si le back doit fournir le reste « du prévu » (voir Hypothèses)
- Source du détail, existant : `frontend/src/features/reporting/api/use-budget-breakdown.ts` (même clé de cache que le bloc Budgets de l'accueil)
- Tests : `frontend/src/features/reporting/ui/forecast-composition.test.tsx`, `frontend/src/features/reporting/model/forecast-composition.test.ts`, `functions/src/reporting/application/get-budget-breakdown.use-case.spec.ts` (si le back change)
- Pas de migration : aucun changement de schéma.

## Hors périmètre
- Détail des autres lignes du récap (CB, factures, reports, revenus attendus).
- Bureau.
- Lien vers l'écran Budgets depuis une ligne du détail.
- Mémoriser l'état ouvert/fermé entre deux visites.

## Hypothèses
- Le détail couvre les catégories de dépense, d'épargne et de virement sortant, comme `budgetRemaining` (`docs/reporting.md`, « Budget restant / revenus attendus »). Revenus et virements entrants sont exclus.
- Le reste d'une catégorie dans le détail = ce que `budgetRemaining` lui compte : max(0, |budget| + réel) si le réel est négatif ou nul, |budget| s'il est positif. Les données existantes ne le garantissent pas : `BudgetCategoryBreakdown.remaining` donne |budget| + réel même pour un réel positif (écart ci-dessus), et peut être négatif (dépassement). Le développeur doit donc plafonner ou exposer un reste « prévu », et prouver CA4 par test.
- Les deux lectures (stats et répartition) utilisent la même fenêtre de période, la même liste de catégories et le même sens de virement (`transferDirection`) ; elles sont faites par deux appels, donc un écart passager est possible si une opération est saisie entre les deux. Non traité.
- « Mobile » = sous le point de rupture `lg`, comme le reste de l'accueil (`dashboard-stats.tsx`).
- Aucun montant du détail n'est recalculé par le front au-delà du filtre, du plafond et du tri.

## Points ouverts
- Aucun (mesure : tranché, pas de mesure).
