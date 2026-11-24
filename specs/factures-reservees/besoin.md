# Besoin — factures-reservees

Lucas, 2026-11-24 : « Il ne faut pas prendre en compte la date de fin de la période pour les dépenses déjà dans transactions. Ce sont des factures à venir, elles sont comptées car la somme est déjà réservée et ne doit pas servir à autre chose. »

## Conception validée par Lucas (« go », 2026-11-24)

1. Période active : toute dépense saisie depuis son début est comptée, sans borne de fin, dans le prévu, les factures à venir, les budgets (répartition) et l'évolution.
2. Période fermée : garde sa borne de fin (pas de double compte).
3. Définitions des soldes inchangées : `pending` reste exclu d'« En banque » et « À venir ».
4. CB non `pending` datée après la fin : comptée dans le prévu et, par définition, dans « À venir ».
5. Alertes (anomalies) : même fenêtre que le prévu.
6. Rythme de dépense : inchangé (argent déjà sorti).
7. Revenus futurs : gardent la borne de fin.

## Précisions de Claude, à confirmer au contrôle du code

- « Dépense » = montant négatif (toutes catégories, ou sans catégorie) ; un montant positif daté après la fin reste borné.
- Période active sans date de fin : le prévu est déjà sans borne, y compris pour les revenus ; comportement inchangé.
- La fin estimée (`estimated_end_date`) ne borne aucun calcul.

Impact attendu : le prévu ne présente jamais comme disponible une somme déjà réservée. Mesure : en recette, aucune dépense datée après la fin d'une période active n'est absente du prévu (0 opération concernée au 2026-11-24).
