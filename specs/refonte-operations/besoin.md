# Besoin

Refonte interface, cycle 3 sur 7 (slug refonte-operations) : écran Opérations — pointage dans la liste, filtres d'état (à pointer, factures à venir, pointées), soldes à jour après pointage, et liens depuis À traiter (dont les anomalies, reportées du cycle 2).

Plan : `specs/refonte-interface/plan.md`. Maquette : `specs/refonte-interface/maquette/Operations.dc.html`.

Consigne pour tout le plan : commits locaux, sans push, sans release ni db push, tant que toute la refonte n'est pas terminée, front et back.

Vérifications réelles des cycles 1 et 2 non faites : Lucas a choisi de continuer sans elles.

## Réponses de Lucas

- Factures : on peut pointer une facture à venir depuis la liste, comme aujourd'hui. Elle sort de l'attente, le solde en banque baisse. La règle `resolvePending` ne change pas.
- Soldes : en banque, à venir et reste à pointer de la période choisie, mêmes chiffres qu'Aujourd'hui. Ils suivent la période et le pointage, pas les filtres de la liste.
- Impact : depuis À traiter, on arrive sur la liste filtrée et on pointe tout en ligne, sans dialogue. Mesure par vérification, sans suivi ajouté.
- Mode : complet.

## Réponses de Lucas après la mini-spec

- Période : la liste démarre sur la période choisie, avec le même sélecteur qu'Aujourd'hui et une option « toutes les périodes ».
- Anomalie : le lien ouvre Opérations filtrée sur les transactions de l'anomalie, marquées « Doublon possible » ou « Dépense inhabituelle ». Petit filtre back accepté.
- Dépassement : le lien ouvre Opérations filtrée sur la catégorie et la période.
- Dépointer une facture : un message indique qu'elle redevient « À pointer », avec une action pour la remettre en facture à venir. La règle ne change pas.
