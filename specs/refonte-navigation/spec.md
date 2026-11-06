# Refonte navigation : coque à 5 entrées + Réglages, jetons de la maquette

## Le problème
Le menu a 13 entrées : Transactions, l'écran le plus utilisé, est la 13e, et le paramétrage (Comptes, Catégories, Tags, Règles, Récurrences) est mélangé aux écrans de consultation. Cycle 1 sur 7 de la refonte (`specs/refonte-interface/plan.md`) : la coque passe à 5 entrées plus Réglages et prend les couleurs de la maquette. Le contenu des écrans ne change pas.

## Critères d'acceptation
- [ ] CA1 — Étant donné la sidebar (grand écran), quand je l'ouvre, alors je vois dans l'ordre Aujourd'hui `/`, Opérations `/transactions`, Analyses `/evolution`, Budgets `/budgets`, Échéances `/calendar`, puis Réglages en bas, puis Déconnexion (6 entrées au lieu de 13). Fr et en.
- [ ] CA2 — Étant donné les pages Évolution, Flux et Dépassements, quand je les ouvre, alors un jeu d'onglets les relie entre elles et l'entrée Analyses reste active ; idem Calendrier et Prévisions sous Échéances. `/transactions/import` garde Opérations active.
- [ ] CA3 — Étant donné la page Réglages, quand je l'ouvre, alors elle liste Comptes, Catégories, Tags, Règles et Récurrences, chacun avec une ligne d'explication et un lien vers sa page ; Réglages reste actif sur ces cinq pages.
- [ ] CA4 — Étant donné la visite guidée « compte », quand je la lance, alors les étapes « catégories » et « récurrences » sont remplacées par une seule étape sur l'entrée Réglages (texte adapté, fr et en), l'étape Budgets pointe toujours l'entrée Budgets, et aucune étape n'est sautée faute de cible.
- [ ] CA5 — Étant donné le clavier hors champ texte, quand j'appuie sur F2 à F6, alors j'arrive sur Aujourd'hui, Opérations, Analyses, Budgets, Échéances ; la pastille de chaque entrée affiche sa touche ; Réglages n'a pas de raccourci.
- [ ] CA6 — Étant donné la palette Ctrl/Cmd + K, quand je cherche, alors elle propose les 5 entrées, Réglages, et chaque page rattachée (Flux, Dépassements, Prévisions, Comptes, Catégories, Tags, Règles, Récurrences) avec les noms de la nouvelle navigation ; les actions (ajouter une transaction, importer un CSV) sont conservées.
- [ ] CA7 — Étant donné une page de la coque, quand elle s'affiche, alors le titre du header est le nom de la nouvelle entrée pour les 5 entrées et pour Réglages, et le nom propre de la page pour une page rattachée (Flux, Comptes…). Sur mobile, la barre du bas (3 entrées + « + » au milieu) utilise les nouveaux noms.
- [ ] CA8 — Étant donné le thème clair ou sombre, quand j'ouvre n'importe quelle page, alors les couleurs de base (fond, surface, texte, texte atténué, bordure, accent, alerte, séries, fond doux, prévu) prennent les valeurs de `.t-light` et `.t-dark` de la maquette, sans retoucher les pages une par une ; la bascule du header continue de fonctionner.

## Règle critique
Aucune page existante ne devient inaccessible : chaque route actuelle du dossier `(dashboard)` est atteignable depuis une entrée du menu, un onglet ou la page Réglages. Test avant le code : table « ancienne route → entrée / onglet / Réglages » vérifiée contre les routes lues dans les `page.tsx` du dossier `(dashboard)` (donc aussi `/budgets/fixed` et `/settings`).

## Mesure d'impact
- Indicateur : clics pour atteindre les écrans clés. Transactions passe de la 13e à la 2e entrée ; menu de 13 à 6 entrées.
- Équipe qui en profite : Performance (temps gagné par l'utilisateur).
- Comptage direct dans le menu, aucun suivi ajouté (réponse de Lucas).

## Exploitation
- Rien de nouveau à observer : front seul, pas de log ajouté. L'avertissement console « Tour target not found » ne doit plus apparaître pour la visite « compte ».
- Retour arrière : `git revert` des commits du cycle. Pas de données ni de back touchés.
- Feature flag : non (visible de tous, mais retour arrière trivial ; commits locaux, aucune release avant la fin de la refonte).

## Parties sensibles
Aucune.

## Ce qui change dans l'existant
`docs/navigation.md` :
- Change la règle « Sidebar : 13 entrées » (6 entrées).
- Change « Raccourcis F2 à F6 » (nouvelles cibles : voir CA5).
- Change « Entrée active » : une page rattachée ou une sous-page active l'entrée de son groupe.
- Change « Bottom-nav : 3 entrées » (noms seulement).
- Change « Titre de page » (nouvelles routes et noms) et « Palette de commandes » (Flux, Prévisions, Récurrences, Règles ajoutées).
- Change « Jetons visuels actuels » (valeurs de la maquette).
- Change « Cibles de la visite guidée » : `nav-categories` et `nav-recurring` disparaissent, une cible Réglages apparaît.
`docs/tour.md` : visite « compte » passe de 7 à 6 étapes ; `nav-categories` et `nav-recurring` ne sont plus des éléments ciblés.

## Fichiers concernés
- À modifier : `frontend/src/shared/ui/layout/sidebar.tsx` — 6 entrées, F2-F6, activité par groupe, cibles de visite
- À modifier : `frontend/src/shared/ui/layout/bottom-nav.tsx` — nouveaux noms
- À modifier : `frontend/src/shared/ui/layout/header-title.ts` — routes et clés
- À modifier : `frontend/src/shared/ui/layout/command-menu.tsx` — entrées et pages rattachées
- À modifier : `frontend/src/features/tour/config/account-tour.ts` — étape Réglages, retrait de 2 étapes
- À modifier : `frontend/src/app/[locale]/globals.css` — valeurs des jetons clair et sombre
- À modifier : `frontend/messages/fr.json`, `frontend/messages/en.json` — espaces `Navigation` et `Tour.account`
- À modifier : pages `evolution`, `flux`, `depassements`, `calendar`, `cashflow` sous `frontend/src/app/[locale]/(dashboard)/` — ajout de la barre d'onglets seulement
- À créer : `frontend/src/app/[locale]/(dashboard)/settings/page.tsx` — page Réglages (aucun fichier existant, vérifié par Glob)
- Tests à modifier : `frontend/src/shared/ui/layout/header-title.test.ts`, `bottom-nav.test.tsx`, `frontend/src/features/tour/config/tour-ui.test.ts`, `tour-flow.test.ts`
- Tests à créer : sidebar (entrées, F2-F6, activité) et accessibilité des routes, à côté de `sidebar.tsx`
- Docs : `docs/navigation.md`, `docs/tour.md` (documentaliste)
- Pas de migration ni de back : cycle front seul.

## Hors périmètre
- Contenu des écrans (Aujourd'hui, Opérations, Analyses, Budgets, Échéances) : cycles 2 à 6.
- Fusion des pages en un seul écran à onglets (cycle 4), nettoyage des anciennes routes et refonte de la barre du bas mobile (cycle 7).
- Push, release, db push : commits locaux uniquement tant que la refonte n'est pas finie.

## Hypothèses
- Route Réglages : `/settings` (aucune route existante ; nom non confirmé).
- Noms en anglais : Today, Transactions, Analysis, Budgets, Due dates, Settings (non confirmés ; le mot « Opérations » n'a pas d'équivalent imposé).
- F2-F6 suivent les 5 entrées dans l'ordre (hypothèse du besoin, non confirmée). F2-F6 restent actifs en mobile comme aujourd'hui (jamais vu en réel).
- Barre du bas mobile : mêmes 3 entrées qu'aujourd'hui (Aujourd'hui, Opérations, Analyses) + « + » ; Budgets, Échéances et Réglages y restent hors d'atteinte, comme aujourd'hui, jusqu'au cycle 7.
- Visite « compte » : une seule étape Réglages remplace catégories + récurrences, ce qui garde les indices d'étape 4 et 5 de `AppTour.tsx:66-71` ; à vérifier en réel.
- Jetons : correspondance maquette → thème : `--bg`→`--background`, `--surface`→`--card`, `--ink`→`--foreground`, `--muted`→`--muted-foreground`, `--line`→`--border`, `--accent`→`--primary` (et non l'`--accent` actuel, qui est un gris de survol, à mapper sur `--soft`), `--s1..s4`→`--chart-1..4`, `--warn` et `--prev` nouveaux. `--destructive` conservé. Valeurs : clair `#F7F7F5 / #FFFFFF / #15181C / #5B636D / #E3E4E0 / #2450C8 / #B4530A / #EEF0EC / #8A9199`, sombre `#111316 / #181B1F / #ECEEF0 / #A0A7B0 / #2A2F35 / #6C90E8 / #CC7A36 / #22262B / #7C838B`.
- Les pages gardent leur composition actuelle : un écran qui a des couleurs en dur ne suit pas les jetons (hors périmètre, à constater).

## Décisions de Lucas
- Titre d'une page rattachée : son nom propre (Flux, Comptes).
- Mobile : rien de plus avant le cycle 7.
- Route `/settings`, noms anglais Today, Transactions, Analysis, Budgets, Due dates, Settings, et F2-F6 confirmés.
- `/budgets/fixed` est rattachée à l'entrée Budgets.
