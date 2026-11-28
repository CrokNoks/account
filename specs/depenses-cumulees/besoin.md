# Besoin — dépenses cumulées

Dans l'écran Analyses (onglet Évolution), afficher une courbe des dépenses cumulées période par période (p1 100 €, p2 100 € → p1 100, p2 200), avec un filtre 3 / 6 / 12 dernières périodes.

## Décisions de Lucas
- Cumul par période budgétaire (pas par mois calendaire).
- Périodes clôturées seulement.
- Nouvelle section sous les barres « Total dépensé ».
- Le cumul démarre à la plus ancienne période de la fenêtre filtrée.
- Front seul : `realExpenses` de `GET /reporting/evolution` déjà disponible.
- Mesure : usage (lecture directe du cumul, sans recalcul à la main).
- Filtre 3 / 6 / 12 dernières périodes clôturées, appliqué à **tout l'onglet Évolution** (total dépensé, cumul, catégorie choisie, solde en banque) : un seul sélecteur en haut de l'onglet (recommandation suivie, Lucas peut revenir dessus).
- Valeur par défaut : 12.
- Moins de périodes clôturées que le filtre : on affiche toutes celles qui existent, sans message ni choix grisé.
- Mode : complet (cumul de montants), pas de partie sensible (somme bigint, règle `spentAmount` existante inchangée).
