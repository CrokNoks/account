# Besoin — rattachement-par-dates

Simplifier le rattachement transaction ↔ période. Décisions de Lucas :

1. **Une seule vérité : les dates.** Plus de `period_id` vivant sur les transactions : trigger `assign_period_id`, rattachement à la bascule et déplacement à la suppression retirés ; `delete_period_clean` choisit les `pending` récurrentes à supprimer par dates. Plus souple : tout se recalcule si on ajoute ou modifie une transaction dans une période fermée.
2. **Fenêtre :** période fermée = [début, fin] ; période active = [début, +∞[ pour dépenses **et** revenus — l'asymétrie dépenses/revenus ne sert à rien. Seule exclusion : la prochaine paie (`pending`, catégorie déclencheuse, `recurringId`), qui appartient à la période suivante. Supprimer l'exception « revenu pointé tardif » et la ligne « Arrivé après la fin ».
3. **Aligner** le détail d'un tag (et le rythme de dépense si pertinent) sur `isInPeriodWindow`.

Les trois en un seul cycle. Partie sensible : calcul qui touche l'argent.

## Réponses de Lucas (cadrage)

- **Impact** : composition du prévu sans écart, et prévu inchangé avant/après pour toute période sans revenu daté après sa fin ; mesuré par une requête SQL avant/après sur les vraies données.
- **Période active sans catégorie déclencheuse** : elle court aussi sans fin pour tout, jusqu'à la clôture à la main. **La date de fin n'est qu'indicative pour une période ouverte (active).**
- **Rythme de dépense** : pour une période active à la fin dépassée, la courbe continue après la fin avec les nouvelles dépenses.
- **Période active à la fin dépassée** : aucun signal à l'écran (un compte épargne n'a besoin que d'une seule période ouverte).
- **`period_id` des transactions** : la colonne est supprimée (migration `DROP COLUMN`, avec trigger, FK et usages), `periodId` disparaît de l'entité, du payload, de l'API et du front ; requêtes `supabase/queries` réécrites par dates.

Mode : complet (argent, règles existantes modifiées).
