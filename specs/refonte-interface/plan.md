# Plan de refonte de l'interface

Maquette : `specs/refonte-interface/maquette/` (copie locale) et https://claude.ai/artifact/AxUNUDKA4FD6WU2VkAYJmk

Consigne de Lucas (2026-11-06) : tout reste en local. Commits sans push, sans release ni `supabase db push`. Aucune release tant que toute la refonte n'est pas terminée, front et back.

Décisions prises : tableau de bord fixe, sans personnalisation ; le solde prévisionnel devient le chiffre principal.

## Reprendre après une coupure

1. Regarder la colonne « État » ci-dessous et `git log --oneline 4a44004..HEAD`.
2. Lire `specs/{slug}/` du cycle en cours (`besoin.md`, `spec.md`, `conception.md`).
3. Relancer `/quickcycle` sur le cycle en cours : un commit déjà fait n'est pas à refaire.

## Cycles

Un cycle = un `/quickcycle`, livrable seul. L'ordre compte : chacun s'appuie sur les précédents.

| # | Slug | Contenu | Indicateur | Mode prévu | État |
| --- | --- | --- | --- | --- | --- |
| 1 | `refonte-navigation` | Coque à 5 entrées + Réglages, jetons visuels | Clics pour atteindre Transactions et le paramétrage | complet | codé, reste à voir en réel |
| 2 | `refonte-aujourdhui` | Écran Aujourd'hui fixe : barre des soldes, rythme, À traiter, budgets, factures. Retrait de la personnalisation | Temps pour connaître le prévu de fin de période | complet, partie sensible (soldes) | codé, écran à voir en réel, `http/aujourdhui.http` à rejouer |
| 3 | `refonte-operations` | Pointage dans la liste, filtres d'état, soldes à jour | Part d'opérations pointées sans passer par un dialogue | complet | à faire |
| 4 | `refonte-analyses` | Répartition, Évolution, Dépassements sur un seul écran à onglets | Nombre de pages à ouvrir pour une analyse | complet | à faire |
| 5 | `refonte-budgets` | Saisie d'un budget avec effet immédiat sur le prévu | Ajustements de budget par période | complet, partie sensible (prévu) | à faire |
| 6 | `refonte-echeances` | Courbe de trésorerie, point bas, calendrier, liste | Consultation des échéances avant une grosse dépense | complet | à faire |
| 7 | `refonte-mobile` | Accueil et saisie mobile, nettoyage des anciennes pages | Temps de saisie d'une opération sur mobile | complet | à faire |

## Points d'attention

- Cycle 1, à voir une fois connecté : menu, onglets, Réglages, F2-F6, visite « compte » (dialogue encore ouvert à l'étape Réglages), bleu en clair et en sombre.
- Cycle 2, à voir une fois connecté : écran à 1440 et 390 px, barre ou lignes signées, clair et sombre, visite `dashboard`. Rejouer `http/aujourdhui.http` avec Supabase local démarré.
- Mise en prod : déployer front et back, puis appliquer `20261106100000_drop_user_preferences.sql`. Irréversible sans sauvegarde.
- Les soldes gardent leurs définitions : `pending` hors soldes, CB non pointée comptée dans le solde à venir (`docs/reporting.md`).
- Les montants restent en centimes entiers.
- Les anciennes routes ne disparaissent qu'au cycle 7, une fois leur remplaçant en place.
