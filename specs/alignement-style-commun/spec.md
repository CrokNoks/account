# Alignement du style commun sur la maquette (cycle 1 sur 3)

## Le problème
Les écrans utilisent le vert pour tout solde positif et le rouge pour tout négatif : le vert ne veut pas dire « bon », et le rouge d'une dépense normale se confond avec une alerte. Les titres de bloc sont en petites capitales grises, les dates en numérique (« 06/11/2026 ») et le compte est loin du menu. Résultat : le prévu et ce qui dépasse sont plus longs à lire que sur la maquette (`specs/refonte-interface/maquette`). Ce cycle ne change que la présentation : aucun montant, aucun calcul.

## Critères d'acceptation
- [ ] CA1 — Étant donné Aujourd'hui, Opérations et Échéances, quand je lis les soldes (Prévu, En banque, À venir, Reste à pointer) et les montants d'opérations ou d'échéances, alors ils sont en encre (jeton `--foreground`), ni verts ni rouges ; le sens se lit au signe (« − » devant un montant négatif, « + » devant une entrée d'argent pour les opérations et échéances).
- [ ] CA2 — Étant donné un budget dépassé (barre et libellé dans Aujourd'hui, Budgets, Analyses), quand il s'affiche, alors l'alerte est en orange (`--warn`) avec un libellé ou un signe (« X de dépassement », « + » pour l'écart) ; un budget non dépassé n'est ni vert ni rouge (accent bleu `--primary` pour la barre). Un prévu ou un solde négatif reste lisible par son « − » ; il est en orange, pas en rouge.
- [ ] CA3 — Étant donné les écrans Aujourd'hui, Opérations, Budgets, Analyses et Échéances, quand je regarde un titre de bloc (« À traiter », « Composition du prévu », « Prévu en fin de période »…), alors il est en 16 px demi-gras (600), casse normale, sans capitales ; le libellé du prévu est en 14 px, 500, couleur atténuée.
- [ ] CA4 — Étant donné une date affichée comme date courte (sélecteur de période, liste d'opérations bureau et mobile, « Ces transactions du … », « Prévu le … », échéances), quand l'interface est en français, alors elle s'écrit « 6 nov. » et une plage « 25 oct. → 24 nov. » ; en anglais, « Nov 6 » et « Oct 25 → Nov 24 » (format de la langue, comme les montants avec `useFormatCurrency`). Une date d'une autre année que l'année en cours porte l'année (« 6 nov. 2025 »).
- [ ] CA5 — Étant donné le menu latéral (grand écran), quand je l'ouvre, alors le haut affiche « Compte » puis le nom du compte actif, qui ouvre la liste des comptes (même choix et même confirmation de sortie qu'avant) ; le logo « Account V2 » n'y est plus et le sélecteur n'est plus dans l'en-tête sur grand écran. Sur mobile (menu masqué), le compte reste choisissable dans l'en-tête.
- [ ] CA6 — Étant donné l'en-tête sur grand écran, quand je le vois, alors un champ « Rechercher ⌘K » est visible ; un clic dessus ouvre le même menu de commandes que ⌘/Ctrl + K (raccourci inchangé).
- [ ] CA7 — Étant donné les soldes, dépassements et échéances, quand on les voit en thème clair, sombre, fr ou en, alors la couleur ne porte jamais seule le sens : chaque montant garde son signe, chaque alerte son libellé ou son signe.

## Règle critique
Chaque montant affiché garde les mêmes chiffres qu'avant (même valeur, mêmes sens `pending` et CB non pointée de `docs/reporting.md`) ; seuls la couleur, le signe « + » et le style changent, et le sens (négatif, dépassement) reste lisible sans la couleur. Test avant le code : pour une série de montants (positif, négatif, zéro, dépassement, très grand), le texte rendu et la teinte choisie par la fonction commune de présentation, en fr et en.

## Mesure d'impact
- Indicateur qui doit bouger : temps pour lire le prévu et repérer ce qui dépasse (et absence de couleur trompeuse : plus aucun vert/rouge sur un solde ou une dépense normale).
- Équipe qui en profite : Performance (temps gagné par l'utilisateur).
- Comment on le mesure : aucun suivi ajouté. Chronométrage manuel avant/après sur l'app lancée (« quel est le prévu ? quelles catégories dépassent ? »), plus une recherche dans le code qui ne trouve plus `text-red-500` / `text-green-500` sur un montant.

## Exploitation
- Rien à observer en prod : front seul, aucun log ajouté ; la console ne doit montrer aucune erreur d'hydratation sur les dates (rendu serveur et navigateur identiques).
- Retour arrière : `git revert` des commits du cycle ; ni données ni back touchés.
- Feature flag : non (présentation seule, retour arrière trivial).

## Parties sensibles
Aucune (aucun calcul, les montants viennent des stats et ne sont pas recalculés).

## Ce qui change dans l'existant
- Change la règle de `docs/reporting.md` « un prévu négatif est rouge, positif vert » (ancienne règle d'affichage de `BalanceBar`) : encre, orange si négatif, signe visible.
- Change `docs/reporting.md` : reste de budget négatif affiché « X de dépassement » en rouge / « +X au-delà du budget » en vert, barre pleine rouge d'une catégorie sans budget, et comparaison de périodes (rouge pour une dépense qui monte, bleue quand elle baisse) : orange d'alerte à la place du rouge ; le vert disparaît.
- Change les tests qui figent rouge/vert : `dashboard-stats.test.tsx:67,72`, `budget-breakdown.test.tsx:52,65,66,98,99`, `budgets-to-watch.test.tsx:67,81`, `period-comparison.test.tsx:40,52,65`, `analyses-screen.test.tsx:160`.
- Change `docs/navigation.md` : Header (titre, thème, langue, séparateur, sélecteur de compte) et Sidebar (logo « Account V2 » remplacé par le compte) ; palette : ajout d'un point d'entrée visible.
- Les dates numériques de l'interface (`dd/MM/yyyy`) disparaissent des écrans listés : `docs/transactions.md` et `docs/periods.md` (affichage seulement).

## Fichiers concernés
- À modifier : `frontend/src/shared/lib/date-only.ts` — fonctions de date courte et de plage selon la langue (avec `date-only.test.ts` existant)
- À modifier : `frontend/src/features/reporting/lib/signed-amount.ts` — fonction commune « signe + teinte » d'un montant (test : `signed-amount.test.ts` existant)
- À modifier (couleurs) : `reporting/ui/dashboard-stats.tsx`, `forecast-composition.tsx`, `budget-breakdown.tsx`, `budgets-to-watch.tsx`, `period-comparison.tsx`, `to-handle.tsx`, `upcoming-deadlines-widget.tsx`, `analyses/overruns-tab.tsx`, `analyses/evolution-tab.tsx`, `transactions/ui/operations-balances.tsx`, `transaction-table.tsx`, `transaction-mobile-list.tsx`, `budgets/ui/budgets-screen.tsx` (sous `frontend/src/features/`)
- À modifier (titres) : `reporting/ui/dashboard-stats.tsx`, `forecast-composition.tsx`, `to-handle.tsx`, `spending-pace.tsx`, `budgets-to-watch.tsx`, `upcoming-deadlines-widget.tsx`, `anomalies-widget.tsx`, `budget-breakdown.tsx`, `transactions/ui/transaction-list.tsx`, `budgets/ui/budgets-screen.tsx:388`
- À modifier (dates) : `periods/ui/period-select.tsx`, `transactions/ui/transaction-table.tsx`, `transaction-mobile-list.tsx`, `transaction-filters.tsx`, `transaction-list.tsx`, `reporting/ui/echeances-upcoming-list.tsx`, `dashboard-stats.tsx`, `tags/ui/tag-detail-drawer.tsx`
- À modifier (coque) : `frontend/src/shared/ui/layout/sidebar.tsx` (compte en haut), `header.tsx` (champ de recherche, sélecteur de compte masqué sur grand écran), `command-menu.tsx` (ouverture depuis le champ), `frontend/src/features/accounts/ui/account-selector.tsx` (présentation dans le menu)
- À modifier : `frontend/messages/fr.json`, `frontend/messages/en.json` — « Compte », « Rechercher » (parité vérifiée par `i18n/messages-parity.test.ts`)
- Tests à modifier : ceux cités ci-dessus, `shared/ui/layout/sidebar.test.tsx`, `operations-balances.test.tsx`, `echeances-upcoming-list.test.tsx`, `period-select.test.tsx`, `shared/ui/mobile-readability.test.ts` (texte ≥ 12 px)
- Vérification réelle : `.http` non pertinent (front seul) ; vérifier à l'écran, 1440 et 390 px, clair/sombre, fr/en
- Pas de migration ni de back.

## Hors périmètre
- Mise en page des écrans (cycle 2 : Aujourd'hui en un bloc, Opérations par jour) et nouveaux contenus (cycle 3 : « Non réparti », sous-titres « jour X sur Y »…).
- Erreurs et actions destructrices (`text-destructive` : suppression, erreurs de formulaire, bannière d'erreur de Budgets), pastilles d'état des opérations (« À venir », « Pointée » : elles ont un libellé), couleurs d'avatars de catégories, graphiques (séries déjà aux jetons).
- Libellés de champs et de filtres en capitales (formulaires, import, filtres) : ce ne sont pas des titres de bloc.
- Dates de l'étape de validation d'import CSV (`formatDateOnly` numérique, à garder pour lever l'ambiguïté jour/mois) et titres de mois du calendrier.
- Champ de recherche sur mobile.

## Hypothèses
- Le champ « Rechercher ⌘K » est dans l'en-tête de la coque (donc sur tous les écrans, grand écran) et pas seulement sur Aujourd'hui ; il ne cherche rien de nouveau (ouvre la palette existante).
- Le « + » est ajouté aux montants de flux (opérations, échéances) ; les soldes ne montrent que le « − » quand ils sont négatifs.
- Un solde négatif prend l'orange d'alerte (pas l'encre) : la maquette n'en montre pas.
- Le sélecteur de compte reste dans l'en-tête sur mobile faute de menu latéral.
- L'année n'apparaît dans une date courte que si elle diffère de l'année en cours (la maquette n'en montre pas).
- Les barres de budget non dépassées passent à l'accent bleu (`--primary`), comme la maquette (`--accent` de la maquette = `--primary` du code, `specs/refonte-navigation/spec.md`).
- Rien de tout cela n'est écrit « confirmé par Lucas » : `besoin.md` donne la liste des changements, pas ces choix de détail.

## Points ouverts
- Épargne et « au-delà du budget » d'un revenu (aujourd'hui vert / gris neutre) : encre avec « + », ou accent bleu ? Proposé : encre avec signe.
- Protocole de la mesure « lecture plus rapide » : chronométrage manuel suffisant, ou un autre indicateur ?
