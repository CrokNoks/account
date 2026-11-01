# Besoin — écarts du tableau de bord

Petits écarts relevés par le garde-fou et le documentaliste après les changements du tableau de bord (commits 543e42a..HEAD) :

1. Supprimer le code mort `frontend/src/shared/lib/percentage.ts` (et son test), qui ne servait qu'au widget Pulse supprimé.
2. Visite guidée du tableau de bord : l'étape « stats » ne surligne plus que la carte « Solde en banque » (`data-tour="stats"` sur `stat-bank`) alors que son texte parle des soldes « en banque, à venir et prévisionnel ». Lucas veut ADAPTER LE TEXTE à la carte surlignée (pas de changement de cible).
3. Convertir la disposition enregistrée en prod de Lucas pour élargir la carte « Revenus / Dépenses » (id `stat-income`, restée en largeur 2 alors qu'elle affiche maintenant deux lignes ; les cartes `stat-bank` et `stat-upcoming` sont aussi en largeur 2 chez lui).

Décisions déjà prises par Lucas :
- libellés « Intérets » laissés tels quels ;
- le prévisionnel continue de compter les factures en attente (« ça force à ranger les transactions »).

Ensuite, le documentaliste corrigera les 19 écarts doc/code qu'il a relevés (rapport déjà rendu), à l'étape de livraison.

## Réponses de Lucas (cadrage)
- Largeur : les 3 cartes de solde (`stat-bank`, `stat-upcoming`, `stat-income`) passent en largeur 4 dans sa disposition, comme la disposition par défaut ; sa visibilité mobile et bureau ne change pas.
- Texte de l'étape « stats » de la visite : « Retrouvez ici votre solde en banque (opérations pointées) pour la période en cours. » (et l'équivalent en anglais).
- Impact : entretien, pas d'indicateur produit ; mesuré par le code mort supprimé et la conformité de la disposition.
- Mode : complet (3 critères).
