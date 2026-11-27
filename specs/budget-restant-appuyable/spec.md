# Indice « appuyable » sur la ligne Budget restant (mobile)

## Le problème
Sur mobile, la ligne « Budget restant » du récap prévu ouvre un volet par catégorie (`detail-budget-restant`), mais rien ne montre qu'on peut appuyer dessus : la fonctionnalité n'est pas découverte.

## Critères d'acceptation
- [ ] CA1 — Étant donné le récap prévu sur mobile, quand la ligne « Budget restant » est appuyable (budget restant non nul et détail non vide), alors un chevron ⌄ est affiché à droite du libellé, il pivote quand le volet est ouvert et revient quand il est replié, et la ligne a un léger fond au toucher. Dans tous les autres cas (bureau, budget restant à 0, détail vide ou absent, autres lignes du récap), aucun chevron ni fond au toucher : l'affichage est inchangé.

## Règle critique
Le chevron n'apparaît que si la ligne est réellement appuyable, la même condition que le bouton `budget-toggle` (`expandable`, `forecast-composition.tsx:42`). Un chevron sur une ligne non cliquable serait trompeur. Testée avant le code : chevron présent dans `budget-toggle`, absent des lignes non appuyables et de `budget-row-desktop`, état pivoté lié à `aria-expanded`.

## Mesure d'impact
- Indicateur qui doit bouger : découverte du volet (moins de friction). Pas de mesure : aucun outil de log front (décision du cycle `detail-budget-restant`, confirmée dans `besoin.md`).

## Exploitation
- Retour arrière : revert du commit front ; aucune donnée touchée.
- Feature flag : non (indice visuel, mobile seulement).

## Parties sensibles
Aucune.

## Ce qui change dans l'existant
Aucune règle de `docs/` modifiée. Ajoute un indice visuel au bouton `budget-toggle` introduit par `detail-budget-restant`.

## Fichiers concernés
- Modifier : `frontend/src/features/reporting/ui/forecast-composition.tsx` — composant `BudgetLine`, bouton `budget-toggle` (`lg:hidden`) ; `budget-row-desktop` et la branche non appuyable restent tels quels.
- Modifier : `frontend/src/features/reporting/ui/forecast-composition.test.tsx` — tests existants des `budget-toggle` (l. 159-210) à compléter.
- Pas de nouveau libellé : le chevron est décoratif (`aria-hidden`), `aria-expanded` porte déjà l'état. Pas de migration.

## Hors périmètre
- Bureau, autres lignes du récap, changement du comportement du volet.

## Hypothèses
- Le chevron vient de `lucide-react`, déjà utilisé dans `calendar-header.tsx`.
- « Léger fond au toucher » = état actif (pression) du bouton, pas de fond au repos.

## Points ouverts
- Aucun.
