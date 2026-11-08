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
| 3 | `refonte-operations` | Pointage dans la liste, filtres d'état, soldes à jour | Part d'opérations pointées sans passer par un dialogue | complet | codé, écran à voir en réel, `functions/http/operations-pointage.http` jamais exécuté |
| 4 | `refonte-analyses` | Répartition, Évolution, Dépassements sur un seul écran à onglets | Nombre de pages à ouvrir pour une analyse | complet | codé, écran à voir en réel, `http/depassements-par-periode.http` à rejouer |
| 5 | `refonte-budgets` | Saisie d'un budget avec effet immédiat sur le prévu | Effet d'un budget sur le prévu, visible sans quitter l'écran | complet, parties sensibles (prévu, concurrence) | codé, écran à voir en réel, `http/budgets-simulation.http` et test SQL à jouer sur Supabase |
| 6 | `refonte-echeances` | Courbe de trésorerie, point bas, calendrier, liste | Consultation des échéances avant une grosse dépense | complet, partie sensible (déjà payée, point bas) | codé, écran à voir en réel, `http/echeances.http` à rejouer |
| 7 | `refonte-mobile` | Accueil et saisie mobile, nettoyage des anciennes pages | Saisie mobile en 3 gestes | complet, partie sensible (montant signé, envoi unique) | codé, écran à voir en réel, `http/saisie-mobile.http` à rejouer |

## Avant toute mise en prod

La refonte est codée, mais aucun écran n'a été vu en réel. Il faut d'abord :

1. Démarrer Docker et Supabase local, appliquer les migrations au local seulement.
2. Jouer les fichiers `http/aujourdhui.http`, `functions/http/operations-pointage.http`, `http/depassements-par-periode.http`, `http/budgets-simulation.http`, `http/echeances.http`, `http/saisie-mobile.http`, et le test SQL `supabase/tests/replace_period_budgets_expected_test.sql`.
3. Ouvrir chaque écran connecté, à 1440 et 390 px, en clair et en sombre, en fr et en, et sur un vrai téléphone pour la saisie.
4. Corriger ce qui casse par `/quickfix`, puis seulement suivre la procédure de mise en prod.

## Vérification du 2026-11-07 (Supabase local)

- Les 4 migrations en attente sont appliquées à la base locale seulement, sans erreur.
- Le test SQL `replace_period_budgets_expected_test.sql` passe sur le vrai schéma local.
- Les 6 fichiers `.http` passent : 173 requêtes sur 173. C'est vu en réel pour le filtre `ids` (aucun accès aux opérations d'un autre compte), le refus 409 `BUDGETS_CHANGED`, la simulation par un membre en lecture seule et la règle « déjà payée ». Deux enregistrements concurrents lancés en même temps donnent un 200 et un 409, sur 3 essais.
- 21 captures automatisées (bureau en clair et en sombre, mobile 390 px en clair), sans erreur JavaScript ni erreur 500.
- Défauts vus à l'écran, à traiter par `/quickfix` avant la mise en prod :
  - La police Geist n'est jamais appliquée : tout s'affiche en police à empattements, et les montants en Courier. Défaut antérieur à la refonte : `--font-sans: var(--font-sans)` se référence lui-même dans `globals.css`.
  - Accueil mobile : libellés de la composition tronqués à 390 px (« CB non po… », « Factures à v… »).
  - Budgets : les champs montrent les montants au format anglais (« 3200.00 »), et un budget stocké en négatif s'affiche « -180.00 ». Le ressaisir avec son signe est refusé. 8 budgets de la base locale sont négatifs.
  - Saisie mobile : le montant vide s'affiche « 0.00 » au format anglais, et les boutons s'appellent « Enregistrer » et « Enregistrer & Nouveau ».
  - Aujourd'hui garde le titre « Tableau de bord » et le texte « Bienvenue sur votre gestionnaire de finances ».
- Pas encore vu : un vrai téléphone (clavier décimal), l'anglais, et le mobile en sombre.
- Corrigés le 2026-11-07 et 08, chacun vu à l'écran : police Geist (`49442a1`), libellés mobiles de la composition (`795df75`), titre d'Aujourd'hui (`487aba2`), format et libellés de la saisie mobile (`c4a9953`), format et signe des champs de budget (`7ccf24e`). Correctifs « jamais de flottant pour l'argent », trouvés en route : `74d7b14`, `e9bb8c1`, `a7018be`.
- Corrigés le 2026-11-08 après comparaison avec la maquette, vus à l'écran en fr et en en (bureau) : un seul titre par écran (`b315655`), bloc « Prochaines factures » (`764edab`), écarts et pourcentages au format de la langue avec l'écart en euros (`38a9875`), revenus en section « Revenus » dans Budgets (`63e0a01`), montants qui suivent la langue (`9e35c9f`). Restent à faire : sous-titres de la maquette (période « jour 13 sur 31 », « Six périodes fermées… ») et vue mobile.

## Points d'attention

- Cycle 1, à voir une fois connecté : menu, onglets, Réglages, F2-F6, visite « compte » (dialogue encore ouvert à l'étape Réglages), bleu en clair et en sombre.
- Cycle 2, à voir une fois connecté : écran à 1440 et 390 px, barre ou lignes signées, clair et sombre, visite `dashboard`. Rejouer `http/aujourdhui.http` avec Supabase local démarré.
- Cycle 3, à voir avec Supabase démarré : jouer `functions/http/operations-pointage.http`, dont l'exclusion des autres comptes par le filtre `ids` (vérifiée seulement sur dépôts simulés), le pointage, le dépointage et les liens de À traiter.
- Cycle 4, à voir une fois connecté : graphiques en clair et en sombre, à 1440 et 390 px, lien d'une catégorie vers Opérations.
- Cycle 6, à voir avec Supabase démarré : jouer `http/echeances.http`, dont la comparaison des dates à minuit UTC.
- Mise en prod : procédure de `specs/refonte-mobile/spec.md` (« Exploitation »), un seul `supabase db push` puis déploiement immédiat du back et du front. Perte assumée des dispositions enregistrées, sans export.
- Les soldes gardent leurs définitions : `pending` hors soldes, CB non pointée comptée dans le solde à venir (`docs/reporting.md`).
- Les montants restent en centimes entiers.
- Les anciennes routes ne disparaissent qu'au cycle 7, une fois leur remplaçant en place.
