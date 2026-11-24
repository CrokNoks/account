# Besoin — alignement-sous-titres

Alignement sur la maquette (`specs/refonte-interface/maquette/*.dc.html`), écarts vus en recette le 2026-11-24 avec Playwright :

2. Aujourd'hui (bureau) : sous-titre de période « 1 nov. → 30 nov. · jour 24 sur 30 » à côté du titre, et prévu titré « Prévu le {date de fin} » comme sur mobile.
3. Rythme de dépense : ligne « Budget X € », légende « Cette période / Période précédente », axe en dates courtes, pas de vide en bas du bloc.
4. Budgets : sous-titre période + jour, « Non réparti » (revenus prévus − budgété), phrase « Modifiez un montant pour voir l'effet sur le prévu ».
5. Analyses : sous-titre « Six périodes fermées, de mai à octobre », et légende de l'écart périmée (« rouge si elle monte » alors que la hausse est orange).
6. Échéances : sous-titre « Vos opérations récurrentes à venir ».

Hors périmètre : colonne « Moy. 6 pér. » de Budgets.

## Réponses (Lucas a délégué les décisions à Claude, 2026-11-24)

- Impact attendu : savoir où l'on en est dans la période (dates, jour X sur Y, prévu daté) sans ouvrir le sélecteur de période ; écrans conformes à la maquette avant la mise en prod de la refonte. Mesure : critères vus en réel sur la recette (captures Playwright à 1440 et 390 px, fr et en) — pas de nouvel indicateur chiffré, c'est un alignement d'affichage.
- Aucun chiffre nouveau calculé côté front sauf « Non réparti » = revenus prévus − total budgété, à partir des montants déjà affichés (centimes entiers) ; un négatif s'affiche avec son signe, en orange (règle `presentAmount` des soldes).
- Les sous-titres suivent la période sélectionnée ; « jour X sur Y » masqué pour une période passée ou sans fin (règle `periodProgress` existante). Le nombre de périodes fermées d'Analyses est le nombre réellement affiché (6 au plus), avec le mois de la première et de la dernière.

## Zones d'ombre tranchées (Claude, délégation de Lucas)

1. « Non réparti » = `plannedIncome` − `plannedExpenses`, c'est-à-dire « Revenus prévus » − « Total budgété » tels qu'affichés par les cartes (virements compris dans les revenus, comme le back) : cohérent avec ce que l'écran montre déjà.
2. « Budget X € » du rythme = `plannedExpenses` des stats de la période (même source que « Total budgété »), lu par le front ; la route `spending-pace` ne change pas.
3. Les textes `desc` existants non affichés ne sont pas réutilisés tels quels : sous-titres de la maquette. Analyses : « {n} périodes fermées, de {mois} à {mois} » d'après les périodes réellement proposées (6 au plus) ; Échéances : « Vos opérations récurrentes à venir ».
4. « Jour X sur Y » partout via `periodEnd` + `periodProgress` (règles existantes, masqué si période passée ou sans fin).
