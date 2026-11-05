# Besoin

Je souhaiterais avoir une page sur laquelle on affiche les dépassements de catégorie période par période.

## Réponses de Lucas (cadrage)

1. Dépassement = le « X de dépassement » de la répartition actuelle (dépense ou épargne dont le réel dépasse le budget), uniquement pour les catégories ayant un budget ≠ 0. Les revenus « au-delà du budget » ne comptent pas.
2. Toutes les périodes fermées (clôturées), donc pas la période active. Les factures en attente (`pending`) ne comptent pas dans le réel.
3. Impact : connaître les catégories qui varient le plus sur une suite de périodes.
4. Décision (correction) : « Non pas de cumul. Pour une catégorie donnée je souhaite voir, pour toutes périodes entre P1 et P2 incluses, un bargraph montrant l'évolution du budget et du dépassement. Une barre par période. »
5. Décisions déjà prises : réel net positif sur une dépense = pas un dépassement ; requête SQL `depassements-par-periode.sql` inchangée ; une période a toujours une date de fin.
