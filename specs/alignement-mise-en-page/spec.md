# Alignement de la mise en page sur la maquette (cycle 2 sur 3)

## Le problème
Sur Aujourd'hui, le prévu, En banque, À venir et la composition sont dans trois cartes séparées, À traiter occupe toute la largeur sous le rythme, et le bloc Budgets cache Revenus, Épargne et Virements derrière quatre onglets. Sur Opérations, chaque ligne répète sa date dans une colonne. Résultat : il faut balayer plus d'écran pour lire le prévu et repérer ce qui dépasse que sur la maquette (`specs/refonte-interface/maquette`, `Main`, `Operations`, `MobileAccueil`). Ce cycle ne change que la disposition et le regroupement : aucun montant, aucun calcul, aucun contenu nouveau (cycle 3).

## Critères d'acceptation
- [ ] CA1 — Étant donné Aujourd'hui sur grand écran avec une période, quand je regarde le haut de l'écran, alors le prévu (chiffre principal), En banque, À venir et la composition du prévu sont dans un seul bloc, avec les mêmes chiffres qu'avant.
- [ ] CA2 — Étant donné Aujourd'hui sur grand écran, quand je regarde sous ce bloc, alors le rythme de dépense (deux tiers de la largeur) et À traiter (un tiers) sont côte à côte, À traiter n'occupant plus toute la largeur ; sur écran étroit ils s'empilent.
- [ ] CA3 — Étant donné Aujourd'hui sur grand écran, quand je regarde la ligne suivante, alors « Budgets variables » (deux tiers) et « Prochaines factures » (un tiers) sont côte à côte ; « Budgets variables » liste les catégories de dépense seules, avec les mêmes montants et barres qu'avant, sans onglets ; Revenus, Épargne et Virements n'y apparaissent plus (ils restent visibles dans Budgets et Analyses).
- [ ] CA4 — Étant donné Aujourd'hui sur mobile, quand je défile, alors le prévu et la composition du prévu forment un seul bloc, suivi de À traiter puis de « Budgets à surveiller » ; le rythme et « Prochaines factures » restent masqués comme avant.
- [ ] CA5 — Étant donné Opérations sur grand écran, quand la liste s'affiche, alors un en-tête par jour (« 6 nov. », date courte selon la langue, sans total) précède les opérations de ce jour, du plus récent au plus ancien, et la colonne Date n'existe plus.
- [ ] CA6 — Étant donné Opérations sur mobile, quand la liste s'affiche, alors les mêmes en-têtes de jour séparent les cartes, et la date n'est plus répétée sur chaque carte.
- [ ] CA7 — Étant donné la liste groupée (bureau et mobile), quand je sélectionne, pointe, modifie, supprime ou transforme en récurrente une opération, ou quand je sélectionne toute la page, alors tout fonctionne comme avant, les marques d'anomalie et l'état de chaque ligne sont conservés ; la pagination reste de 25 opérations par page, et un jour coupé entre deux pages reprend son en-tête sur la page suivante.
- [ ] CA8 — Étant donné la visite guidée du tableau de bord, quand elle démarre sur grand écran ou sur mobile, alors chaque cible (`stats`, `to-handle`, `budget-breakdown`, `add-transaction` ; `budgets-to-watch` et `nav-add` sur mobile) existe une seule fois à l'écran de cette largeur et les étapes se déroulent comme avant.

## Règle critique
Le regroupement par jour ne perd, ne duplique ni ne réordonne aucune opération : chaque opération apparaît une fois, sous l'en-tête de son jour calendaire (la date de la transaction lue en UTC, comme `formatShortDate`, jamais l'heure locale du navigateur), les jours du plus récent au plus ancien et l'ordre de la page à l'intérieur d'un jour. Test avant le code : une fonction pure de regroupement (entrée : opérations d'une page ; sortie : `{ date, rows }[]`) vérifiée sur plusieurs jours, un jour avec plusieurs opérations, une page vide, une date à minuit UTC en bordure d'année et la conservation du total d'opérations.

## Mesure d'impact
- Indicateur qui doit bouger : temps pour lire le prévu et repérer ce qui dépasse (cycle 2 : moins de blocs à balayer, budgets de dépense seuls, jours regroupés dans Opérations).
- Équipe qui en profite : Performance (temps gagné par l'utilisateur).
- Comment on le mesure : aucun suivi ajouté. Chronométrage manuel avant/après sur l'app lancée, comme au cycle 1 (« quel est le prévu ? quelles catégories dépassent ? » sur Aujourd'hui, « qu'ai-je dépensé le 6 nov. ? » sur Opérations). Avant = capture de l'écran actuel, 1440 et 390 px.

## Exploitation
- Rien à observer en prod : front seul, aucun log ajouté ; la console ne doit montrer aucune erreur d'hydratation ni avertissement de visite « Tour target not found » sur Aujourd'hui.
- Retour arrière : `git revert` des commits du cycle ; ni données ni back touchés.
- Feature flag : non (disposition seule, retour arrière trivial).

## Parties sensibles
Aucune : pas d'argent recalculé (les montants viennent des stats et de la répartition), pas d'algorithme au sens du skill (un regroupement par date est couvert par la règle critique), pas de concurrence, pas de nouvelle brique.

## Ce qui change dans l'existant
- Change `docs/reporting.md`, « Écran Aujourd'hui, fixe » : l'ordre des blocs (barre des soldes, composition, rythme, À traiter, Budgets, Factures) devient hero unique (prévu + En banque + À venir + composition), rythme 2/3 + À traiter 1/3, Budgets variables 2/3 + Prochaines factures 1/3 ; le bloc Budgets (4 onglets Dépenses/Revenus/Épargne/Virements) devient « Budgets variables », dépenses seules. Sur mobile, mêmes données, prévu et composition dans un seul bloc.
- Change `docs/reporting.md`, règle de la répartition du budget : la répartition reste calculée pour les quatre types (Budgets et À traiter la lisent), seul son affichage sur Aujourd'hui se limite aux dépenses.
- Change `docs/tour.md` : `stats` est posé sur le bloc hero (prévu + soldes + composition) et `budget-breakdown` sur « Budgets variables » ; mêmes noms de cibles, même nombre d'étapes.
- Change `docs/transactions.md` : la liste d'Opérations n'a plus de colonne Date ; la date courte devient l'en-tête de chaque jour (bureau et mobile).
- Change les tests qui figent l'ancienne disposition : `page.test.tsx` (ordre des blocs, onglets), `budget-breakdown.test.tsx` (onglet Revenus, lignes 69-75), `transaction-list.test.tsx` (colonne Date, dates sur carte).

## Fichiers concernés
- À modifier (Aujourd'hui, `frontend/src/`) : `app/[locale]/(dashboard)/page.tsx` (grilles 2/3 + 1/3, cibles `data-tour`), `features/reporting/ui/dashboard-stats.tsx` (`BalanceBar`, devient le bloc hero), `forecast-composition.tsx` (sans carte propre, dans le hero), `spending-pace.tsx`, `to-handle.tsx`, `budget-breakdown.tsx` (dépenses seules, sans onglets), `upcoming-deadlines-widget.tsx`, `budgets-to-watch.tsx` (mobile : même style de bloc)
- À modifier (Opérations, `frontend/src/features/transactions/ui/`) : `transaction-table.tsx` (en-têtes de jour, colonne Date retirée), `transaction-mobile-list.tsx` (en-têtes de jour), `transaction-list.tsx` (regroupement, sélection de toute la page)
- À créer : `frontend/src/features/transactions/model/group-by-day.ts` et `group-by-day.test.ts` (Glob : absents ; règle critique)
- À modifier : `frontend/messages/fr.json`, `en.json` — titre « Budgets variables » (parité vérifiée par `i18n/messages-parity.test.ts`)
- Tests à modifier : `app/[locale]/(dashboard)/page.test.tsx`, `features/reporting/ui/budget-breakdown.test.tsx`, `dashboard-stats.test.tsx`, `forecast-composition.test.tsx`, `to-handle.test.tsx`, `spending-pace.test.tsx`, `upcoming-deadlines-widget.test.tsx`, `features/transactions/ui/transaction-list.test.tsx`, `features/tour/config/dashboard-tour.test.ts` et `tour-ui.test.ts` si les cibles bougent, `shared/ui/mobile-readability.test.ts` (texte ≥ 12 px sur l'en-tête de jour)
- Vérification réelle : `.http` non pertinent (front seul) ; vérifier à l'écran, 1440 et 390 px, clair/sombre, fr/en, visite guidée jouée
- Pas de migration ni de back (le projet gère le schéma par `supabase/migrations`, non concerné).

## Hors périmètre
- Cycle 3 : « Non réparti », sous-titres « jour X sur Y », trait du jour sur les barres, « Charges fixes », phrase d'anomalie du back, nouveaux contenus.
- Total par jour dans les en-têtes (Lucas : sans total).
- Détail d'un tag (`tag-detail-drawer.tsx`, liste de ses propres transactions) : écran distinct, aucun critère ne le vise.
- Onglets Revenus, Épargne et Virements : retirés d'Aujourd'hui seulement (décision de Lucas dans `besoin.md`) ; Budgets et Analyses inchangés.
- Calculs, filtres, pagination (25 par page) et styles de couleur du cycle 1.

## Hypothèses
- Chemins d'exposition de la liste d'opérations : tableau bureau, cartes mobile, mode `compact` de `TransactionList` (plus aucun appelant en dehors d'un test) et liens venus d'ailleurs (`ids`, `categoryId`, `state`) passent tous par le même composant : tous sont groupés par jour.
- Le « tout sélectionner » de la colonne de cases disparaît avec l'en-tête de tableau ; il est remplacé par une case ou un lien « tout sélectionner » au-dessus de la liste, sur bureau et mobile (la sélection ne couvre que la page affichée, règle de `docs/transactions.md`). Position exacte : au développeur.
- Un jour coupé entre deux pages reprend son en-tête sur la page suivante (la pagination reste côté back).
- « Budgets à surveiller » sur mobile garde dépenses et épargne (la maquette mobile ne change pas son contenu) ; seul le bloc bureau devient dépenses seules.
- `data-tour="stats"` passe sur le bloc hero entier : le texte de l'étape (prévu, banque, à venir) reste juste.
- Le tiers droit de « Prochaines factures » garde son contenu actuel (7 jours, 5 lignes, total des lignes affichées) : seule sa place change.
- Rien ici n'est « confirmé par Lucas » en dehors des deux réponses de `besoin.md` (dépenses seules ; en-têtes de jour sans total sur bureau et mobile, sélection et actions de ligne conservées).

## Points ouverts
- Un dépassement d'épargne apparaît encore dans À traiter (`current-overruns` couvre dépense et épargne, `docs/reporting.md`) mais sa barre n'est plus dans Aujourd'hui sur bureau : acceptable, ou « Budgets variables » doit-il garder l'épargne ? Proposé : dépenses seules, comme décidé ; le lien de À traiter ouvre Opérations filtré sur la catégorie.
- Protocole de la mesure : chronométrage manuel suffisant, comme au cycle 1 ? Proposé : oui.
