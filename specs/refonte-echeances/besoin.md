# Besoin

Refonte interface, cycle 6 sur 7 (slug refonte-echeances) : écran Échéances — courbe de trésorerie, point bas, calendrier, liste des échéances à venir.

Plan : `specs/refonte-interface/plan.md`. Maquette : `specs/refonte-interface/maquette/Echeances.dc.html`.

Consigne pour tout le plan : commits locaux, sans push, sans release ni db push, tant que toute la refonte n'est pas terminée, front et back.

Vérifications réelles des cycles 1 à 5 non faites : Lucas a choisi de continuer sans elles.

Reporté du cycle 2 : le total des échéances ne porte que sur les 5 affichées, libellé à revoir.

## Réponses de Lucas

- Point bas : calcul existant (solde du jour et récurrences), avec une mention claire « dépenses courantes non comprises ».
- Doublon : la trésorerie écarte une récurrence déjà payée le même jour, avec la même règle que le calendrier (même jour, même montant, libellé contenu). Change la règle existante de `docs/reporting.md`.
- Calendrier : style de la maquette, en gardant mois au choix, semaine, passé et détail du jour.
- Impact : courbe, point bas, calendrier et liste sur un seul écran, sans changer de page. Mesure par vérification, sans suivi ajouté.

## Mode

Complet : le point bas est un chiffre d'argent, et une règle existante change.

## Réponses de Lucas après la mini-spec

- Facture à venir sans récurrence correspondante : absente de la courbe, et l'écran le dit. Pas de nouvelle règle d'argent.
- Bloc Factures d'Aujourd'hui : il lit aussi le mois suivant quand la fenêtre de 7 jours le touche. À corriger dans ce cycle.
