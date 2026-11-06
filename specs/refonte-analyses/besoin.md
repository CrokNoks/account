# Besoin

Refonte interface, cycle 4 sur 7 (slug refonte-analyses) : Répartition, Évolution et Dépassements sur un seul écran à onglets.

Plan : `specs/refonte-interface/plan.md`. Maquette : `specs/refonte-interface/maquette/Analyses.dc.html`.

Consigne pour tout le plan : commits locaux, sans push, sans release ni db push, tant que toute la refonte n'est pas terminée, front et back.

Vérifications réelles des cycles 1 à 3 non faites : Lucas a choisi de continuer sans elles.

Décidé au cycle 2 : les statistiques par tags et le patrimoine net sont supprimés, ils ne reviennent pas dans Analyses.

## Réponses de Lucas

- Répartition : par défaut, la dernière période fermée comparée à la précédente. La période de comparaison reste modifiable.
- Graphiques : on prend la maquette (barres fixes et variables, une catégorie au choix, tableau catégories × périodes) et on garde l'évolution du solde en banque. La liste et le graphique des dépassements catégorie par catégorie sont remplacés par le tableau.
- Impact : les trois analyses sont sur un seul écran, changer d'onglet ne recharge pas la page. Mesure par vérification, sans suivi ajouté.
- Mode : complet.

## Réponses de Lucas après la mini-spec

- Fixes et variables : pas de découpage, une barre par période avec le total des dépenses. Aucune donnée ne permet la distinction aujourd'hui.
- Réel de la catégorie choisie : celui des dépassements, sans factures en attente, via un petit ajout back. Un seul calcul.
