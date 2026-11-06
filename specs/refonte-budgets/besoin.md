# Besoin

Refonte interface, cycle 5 sur 7 (slug refonte-budgets) : écran Budgets — saisie d'un budget avec effet immédiat sur le prévu.

Plan : `specs/refonte-interface/plan.md`. Maquette : `specs/refonte-interface/maquette/Budgets.dc.html`.

Consigne pour tout le plan : commits locaux, sans push, sans release ni db push, tant que toute la refonte n'est pas terminée, front et back.

Vérifications réelles des cycles 1 à 4 non faites : Lucas a choisi de continuer sans elles.

Point à trancher : aucune donnée ne distingue les budgets fixes des variables.

## Réponses de Lucas

- Fixes et variables : une seule liste, triée par risque de dépassement. Pas de nouvelle donnée, pas de migration.
- Enregistrement : le prévu change dès la saisie, en simulation. Rien n'est enregistré avant un clic. On peut annuler sans toucher aux autres écrans.
- Période fermée : modifiable comme aujourd'hui, avec un message prévenant que les dépassements passés vont changer.
- Impact : voir l'effet d'un budget sur le prévu sans quitter l'écran. Mesure par vérification, sans suivi ajouté.

## Mode

Complet : la saisie doit respecter le calcul du prévu de `docs/reporting.md`.

## Réponses de Lucas après la mini-spec

- Compte partagé : si les budgets ont changé depuis l'ouverture, l'enregistrement est refusé, avec un message et le rechargement des montants.
- Tri : % consommé décroissant, factures en attente comprises.
- Bloc Budgets d'Aujourd'hui : inchangé.
