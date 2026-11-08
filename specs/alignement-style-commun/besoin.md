# Besoin — alignement du style sur la maquette

Aligner le style des écrans sur la maquette (specs/refonte-interface/maquette) : couleurs des montants (encre, accent bleu, alerte orange au lieu de vert/rouge), titres de bloc en 16 px demi-gras au lieu de petites capitales, dates courtes (« 25 oct. → 24 nov. », « 6 nov. ») au lieu de dates numériques, compte en haut du menu latéral à la place du logo et champ « Rechercher ⌘K » visible, mise en page d'Aujourd'hui (prévu + composition dans un seul bloc, rythme et À traiter côte à côte), Opérations groupées par jour, « Non réparti » sur Budgets, sous-titres « jour X sur Y » (Aujourd'hui, Budgets), « Six périodes fermées… » (Analyses), « Vos opérations récurrentes à venir » (Échéances).

Origine : comparaison de l'app lancée à la maquette du 2026-11-08 (captures sur le compte de test local).

## Réponses de Lucas (2026-11-08)

- Découpage en 3 cycles :
  1. `alignement-style-commun` (ce cycle) : couleurs des montants (encre, accent bleu, alerte orange au lieu de vert/rouge), titres de bloc en 16 px demi-gras au lieu de petites capitales, dates courtes au lieu de dates numériques, compte en haut du menu latéral à la place du logo, champ « Rechercher ⌘K » visible.
  2. `alignement-mise-en-page` : Aujourd'hui (prévu + composition dans un seul bloc, rythme et À traiter côte à côte), Opérations groupées par jour.
  3. `alignement-contenus` : « Non réparti » sur Budgets (revenus prévus − total budgété ; négatif affiché signé, en orange d'alerte), sous-titres « jour X sur Y » (Aujourd'hui, Budgets), « Six périodes fermées… » (Analyses), « Vos opérations récurrentes à venir » (Échéances).
- Impact attendu : lecture plus rapide — temps pour lire le prévu et repérer ce qui dépasse, sans couleur trompeuse (le vert ne veut pas dire « bon »).
