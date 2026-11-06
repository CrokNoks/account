# Besoin

Refonte interface, cycle 2 sur 7 (slug refonte-aujourdhui) : écran Aujourd'hui fixe — barre des soldes (en banque, à venir, prévu), rythme de dépense, À traiter, budgets, factures — et retrait de la personnalisation du tableau de bord.

Décisions de Lucas : tableau de bord fixe, solde prévisionnel en chiffre principal.

Plan : `specs/refonte-interface/plan.md`. Maquette : `specs/refonte-interface/maquette/Main.dc.html`.

Consigne pour tout le plan : commits locaux, sans push, sans release ni db push, tant que toute la refonte n'est pas terminée, front et back.

Vérification réelle du cycle 1 non faite.

## Réponses de Lucas

- Widgets : Patrimoine net, Statistiques par tags et Dernières transactions sont supprimés de l'interface. La page Tags et le détail d'un tag restent.
- Barre des soldes : elle s'affiche quand tous ses segments sont positifs. Sinon, lignes signées : en banque, CB, factures, budget restant, revenus attendus, prévu.
- Impact : le prévu et sa composition sont visibles à l'ouverture de l'app, sans clic ni défilement. Mesure par vérification, sans suivi ajouté.

## Correspondances annoncées à Lucas

- À traiter reprend les anomalies, plus les CB à pointer et les dépassements en cours.
- Factures reprend Prochaines échéances. Budgets reprend la répartition du budget.
- La visite guidée « dashboard » garde ses étapes, sur les blocs équivalents de l'écran fixe.
- Rythme de dépense : cumul de la période comparé à la période précédente au même jour, factures en attente exclues.

## Préférences (décision de Lucas)

Tout retirer maintenant : module back, routes, dispositions enregistrées, avec une migration écrite dans ce cycle. Elle n'est pas appliquée (pas de `supabase db push`) avant la fin de toute la refonte. Le code déployé en production n'est pas modifié d'ici là.

Mode : complet.

## Réponses de Lucas après le canard

- Dépassement en cours : même calcul que la répartition du budget, factures en attente comprises. Un seul chiffre à l'écran.
- Sans période : tout l'écran est remplacé par une explication et un bouton pour créer une période.
- Rythme : toutes les sorties d'argent, dépenses et sorties sans catégorie, factures en attente exclues.
- Routes `net-worth` et `reporting/tags-summary` : supprimées avec leurs hooks et leurs tests.
