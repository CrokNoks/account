# Spec — alignement-sous-titres

Mode complet. Sources : `besoin.md` (réponses et zones d'ombre déjà tranchées, non rouvertes), `docs/reporting.md` (section « Rythme de dépense, sous-titres : état au 2026-11-24 »), `docs/budgets.md` (« Écran Budgets »), `docs/periods.md` (`periodEnd`), maquettes `Main`, `Budgets`, `Analyses`, `Echeances` (`.dc.html`).

## Objectif
Aligner cinq écrans sur la maquette : sous-titres, ligne « Budget », « Non réparti », légende d'écart. Résultat : on sait où l'on en est dans la période sans ouvrir le sélecteur.

Aucune règle de `docs/` n'est changée. Le calcul « Non réparti » est nouveau côté écran, mais il n'est pas une nouvelle règle de back (voir la règle critique).

## Critères d'acceptation
Chacun se vérifie en fr et en, à 1440 px et à 390 px. Une précision de largeur est indiquée seulement quand elle diffère.

1. **Aujourd'hui, bureau : période et prévu datés.**
   - À côté du titre s'affiche « {début} → {fin} · jour X sur Y », en dates courtes de la langue. Exemple fr : « 1 nov. → 30 nov. · jour 24 sur 30 ».
   - Le titre du prévu est « Prévu le {date de fin} », comme sur mobile. Sans fin, il reste « Prévu en fin de période ».
   - « jour X sur Y » est masqué pour une période passée ou sans fin. La fin est celle de `periodEnd` (fin, sinon fin estimée, sinon rien). Sans fin du tout, seul le début s'affiche (règle `formatShortRange`).
   - À 390 px : l'accueil mobile garde son « Prévu le… » et son « Jour X sur Y » actuels, sans doublon ni débordement.

2. **Rythme de dépense : budget, légende, axe, hauteur.**
   - Une ligne « Budget {montant} » est visible sur le graphique. Le montant est « Total budgété » (`plannedExpenses`) de la période sélectionnée.
   - Sans budget (0), la ligne est absente.
   - La légende « Cette période / Période précédente » est visible sous ou à côté de la courbe, et pas seulement dans l'infobulle. « Période précédente » n'apparaît que s'il y a une précédente.
   - L'axe horizontal affiche des dates courtes (ex. « 1 nov. », « 8 nov. », « 24 nov. ») et non plus des numéros de jour.
   - Le bloc n'a pas de vide en bas, quelle que soit la hauteur du bloc « À traiter » voisin.

3. **Budgets : sous-titre de période et phrase d'aide.**
   - Le sous-titre « {début} → {fin} · jour X sur Y » suit la période sélectionnée, avec les mêmes règles de masquage que le critère 1.
   - La phrase « Modifiez un montant pour voir l'effet sur le prévu » apparaît dans le bloc des budgets, à côté du rappel du jour s'il est affiché. Elle est traduite en en.

4. **Budgets : « Non réparti ».**
   - La carte du haut affiche « Non réparti » = « Revenus prévus » − « Total budgété », tels qu'affichés, en plus des deux cartes existantes.
   - Exemple : 3 200,00 − 2 410,00 donne 790,00.
   - Un résultat négatif s'écrit avec son « - » et en orange. Un résultat positif ou nul s'écrit en encre, sans signe.
   - Il change de période avec la sélection et suit les saisies non enregistrées comme les deux cartes voisines (simulation sinon stats enregistrées), avec le même grisage pendant le calcul. Voir Hypothèses.

5. **Analyses : sous-titre et légende de l'écart.**
   - Le sous-titre est « {n} périodes fermées, de {mois} à {mois} ». Exemple fr : « Six périodes fermées, de mai à octobre ». Il décrit les périodes réellement proposées (6 au plus), de la plus ancienne à la plus récente.
   - La légende de l'écart de la Répartition dit « orange si elle monte, bleu si elle baisse » pour une dépense, en fr comme en en. Elle ne parle plus de rouge, et l'épargne reste grise.
   - Cela correspond à la règle de `docs/reporting.md` (« Comparaison » : orange `--warn`, plus de rouge).

6. **Échéances : sous-titre.** Le sous-titre « Vos opérations récurrentes à venir » s'affiche sous ou à côté du titre, traduit en en.

## Règle critique (test écrit avant le code)
**« Non réparti » = « Revenus prévus » − « Total budgété », en centimes entiers (`bigint`), sans flottant.**
- Les deux montants sont ceux des stats (`plannedIncome`, `plannedExpenses`), lus en chaînes de centimes.
- Le résultat passe par `presentAmount(..., 'balance', ...)`. Un négatif est écrit avec « - » et orange `--warn`. Un positif est en encre, sans « + ».
- Cas à couvrir : positif, zéro, négatif, montants au-delà de 2^53 (exact en bigint), identité avec l'affichage des deux cartes.

## Mesure d'impact
- Indicateur : aucun chiffre nouveau (alignement d'affichage), comme dit dans `besoin.md`.
- Mesure : les 6 critères vus sur la recette par captures Playwright à 1440 et 390 px, en fr et en.
- Un critère n'est « livré ✅ » que vu en réel (application lancée). Sinon on le dit.

## Exploitation
- Retour arrière : `git revert` des commits du cycle. Pas de migration, pas de donnée, pas de route back modifiée.
- Pas de feature flag : changement d'affichage seul.
- Ordre de déploiement : sans contrainte, front seul.

## Parties sensibles
Aucune retenue.
- « Non réparti » touche à l'argent. Mais c'est une soustraction affichée de deux montants déjà fournis par le back. Elle n'écrit rien, n'entre dans aucun autre calcul, et le prévu reste calculé une seule fois par `computePeriodForecast`.
- Je ne la classe donc pas en point de contrôle (pas d'algorithme ni de concurrence). Le risque réel, signe et exactitude en bigint, est couvert par le test écrit avant le code.
- Si Lucas veut malgré tout valider la conception avant le code, c'est son choix.

## Chemins d'exposition
Aucune règle de visibilité ou de droit d'accès n'est ajoutée. Les écrans lisent déjà ces données sous la garde de connexion.

## Hypothèses
- **« Non réparti » suit les mêmes valeurs que les cartes voisines** (`plannedIncome` / `plannedExpenses` de la simulation sinon des stats), donc il bouge pendant la saisie et se grise pendant le calcul. Raison : l'afficher figé à côté de deux cartes qui bougent donnerait un écart visible entre les trois chiffres (décision du garde-fou, déléguée par Lucas).
- **Virements comptés dans les revenus**, comme le back (zone d'ombre de `docs/budgets.md` tranchée par `besoin.md` n°1). Le tableau « Dépenses » de l'écran affiche les virements alors que « Total budgété » les exclut : cet écart existant n'est pas traité ici.
- **Mois du sous-titre d'Analyses** : mois de la date de début de chaque période, la plus ancienne et la plus récente affichées. La maquette ne le précise pas.
- **Une seule période fermée** : « Une période fermée, {mois} ». Aucune : pas de sous-titre, le message existant suffit. La maquette ne couvre ni l'un ni l'autre.
- **Axe du rythme** : environ 5 repères de dates courtes, du début au dernier jour tracé (maquette : 25 oct., 1 nov., 8 nov., 15 nov., 24 nov.).
- **Sous-titres à 390 px** : s'ils existent déjà en mobile sur Aujourd'hui (« Jour X sur Y » du hero), ils ne sont pas dupliqués. Sur Budgets, Analyses et Échéances, ils s'affichent aussi en mobile, en passant à la ligne si besoin. La maquette mobile ne les contredit pas.
- **Le bloc Rythme de dépense** lit `plannedExpenses` des stats déjà chargées pour Aujourd'hui, sans nouvel appel. `plannedExpenses` inclut l'épargne, comme le rythme (dépense + épargne) : les deux sont comparables.
- **Sous-titre d'Aujourd'hui en bureau** : le sélecteur de période reste en place. Seul le texte à côté du titre est ajouté.

## Points ouverts
- Aucune décision de Lucas bloquante : toutes les zones d'ombre de `besoin.md` sont tranchées.
- Reste connu et non traité : la colonne « Moy. 6 pér. » de Budgets est hors périmètre, dit dans `besoin.md`.

## Hors périmètre
- Colonne « Moy. 6 pér. » de Budgets.
- Route `spending-pace` (inchangée).
- Textes `desc` existants non affichés, qui ne sont pas réutilisés tels quels.
- Légende des Dépassements.

## Fichiers concernés
Chemins vérifiés par Glob/Grep. Le schéma n'est pas touché : pas de migration.

À modifier :
- `frontend/src/features/reporting/ui/dashboard-stats.tsx` : sous-titre, titre « Prévu le… » en bureau.
- `frontend/src/features/reporting/ui/dashboard-stats.test.tsx` : tests des deux points ci-dessus.
- `frontend/src/features/reporting/ui/spending-pace.tsx` : ligne Budget, légende, axe, hauteur.
- `frontend/src/features/reporting/ui/spending-pace.test.tsx` : tests de ces quatre points.
- `frontend/src/features/budgets/ui/budgets-screen.tsx` : sous-titre, « Non réparti », phrase d'aide.
- `frontend/src/features/budgets/ui/budgets-screen.test.tsx` : tests de ces trois points et de la règle critique.
- `frontend/src/features/reporting/ui/analyses-screen.tsx` : sous-titre.
- `frontend/src/features/reporting/ui/analyses-screen.test.tsx` : test du sous-titre.
- `frontend/src/features/reporting/ui/echeances-screen.tsx` : sous-titre.
- `frontend/src/features/reporting/ui/echeances-screen.test.tsx` : test du sous-titre.
- `frontend/messages/fr.json` et `frontend/messages/en.json` : nouveaux textes, légende de l'écart corrigée (clé `legend`, ligne 220), et textes `desc` inutilisés (lignes 150 et 202), à ne pas réutiliser.

À réutiliser sans les modifier :
- `frontend/src/features/reporting/model/period-progress.ts` (`periodProgress`).
- `frontend/src/features/periods/model/period-end.ts` (`periodEnd`).
- `frontend/src/features/reporting/lib/signed-amount.ts` (`presentAmount`).

Selon l'implémentation :
- Un module de calcul ou un test de « Non réparti » dans `features/budgets/model/` (non existant, ligne « Créer » à confirmer par le développeur après Glob).
- Une vérification en réel sur la recette : `frontend/e2e/` (spec Playwright existant `reporting-budgets.spec.ts` à étendre si pertinent).
- `docs/reporting.md` et `docs/budgets.md` : mise à jour par le documentaliste après le cycle, pas par ce cycle.
