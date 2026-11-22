# Accessibilité des formulaires : libellés liés à leurs champs

Mode express. Même correctif que `3e43e0b` (tiroirs de période).

## Problème / objectif

Dans les formulaires restants du front, des libellés visibles ne sont pas liés à leur champ. Un lecteur d'écran ne les annonce pas, et un clic sur le libellé ne place pas le focus dans le champ. Objectif : chaque libellé visible existant est lié à son champ.

## Critères d'acceptation

1. Dans chacun des formulaires listés, chaque libellé visible existant est lié à son champ : un clic sur le libellé met le champ au focus, et `getByLabelText("<libellé>")` le trouve.
2. Aucun champ sans libellé visible n'est touché (recherche, cases de sélection...). Aucun nom accessible n'est ajouté.
3. Aucun changement de comportement : l'affichage, les valeurs, les validations et les envois sont identiques à avant.
4. Les parcours e2e existants (`frontend/e2e/*.spec.ts` et `frontend/e2e/lib/steps.ts`) qui trouvent ces champs par placeholder ou sélecteur technique les trouvent par `getByLabel`, et restent verts sur la recette.

## Règle critique (testée avant le code)

Un libellé visible est lié à son champ. Pour chaque formulaire, un test composant `getByLabelText` est écrit d'abord et échoue tant que le lien manque.

## Formulaires concernés (`frontend/src/features/...`)

- tags : `tags/ui/create-tag-dialog.tsx`, `tags/ui/tag-list.tsx`
- categories : `categories/ui/create-category-dialog.tsx`, `categories/ui/category-list.tsx`
- recurring : `recurring/ui/create-recurring-dialog.tsx`, `recurring/ui/recurring-transaction-list.tsx`
- smart-rules : `smart-rules/ui/create-smart-rule-dialog.tsx`, `smart-rules/ui/smart-rules-list.tsx`
- accounts : `accounts/ui/account-form.tsx`
- transactions : `transactions/ui/transaction-form.tsx`, `transactions/ui/transaction-filters.tsx`, `transactions/ui/import/import-mapping-step.tsx`, `transactions/ui/import/import-upload-step.tsx`
- reporting : `reporting/ui/analyses/breakdown-tab.tsx` (peut-être déjà correct : à vérifier, rien à changer si c'est le cas)

Tous ces fichiers existent (Glob). Les listes (`*-list`) sont concernées pour leurs formulaires d'édition en ligne, s'ils ont des libellés visibles.

## Chemins d'exposition

Pas de règle de visibilité ni de droit d'accès ici. Chaque formulaire du périmètre est couvert par le critère 1. Tout autre formulaire du front est hors périmètre : les tiroirs de période sont déjà faits (`3e43e0b`), et Lucas n'en cite pas d'autres dans `besoin.md`.

## Parties sensibles

Aucune (ni argent, ni algorithme, ni concurrence, ni nouvelle brique).

## Mesure d'impact

Indicateur : nombre de champs de formulaire avec un libellé visible non lié = 0. Mesure : tests composant (`getByLabelText`) et parcours e2e qui trouvent les champs par leur libellé.

## Exploitation

Retour arrière : `git revert` du ou des commits. Pas de feature flag (changement de balisage uniquement, sans logique).

## Hypothèses

- Les formulaires de `docs/*.md` n'ont pas de règle sur l'accessibilité : rien à changer côté doc.
- Le passage en `getByLabel` ne vaut que pour les champs qui ont un libellé visible. Un champ e2e sans libellé visible garde son sélecteur actuel (par exemple `button[type="submit"]`, `div.group`).
- Le projet n'a pas de fichier de migration à prévoir : aucun changement de données.

## Points ouverts

Aucun.

## Fichiers concernés

À modifier :
- les 14 fichiers de « Formulaires concernés » ;
- e2e : `frontend/e2e/categories.spec.ts`, `frontend/e2e/data.spec.ts`, `frontend/e2e/lib/steps.ts`, `frontend/e2e/recurring.spec.ts`, `frontend/e2e/smart-rules.spec.ts`, `frontend/e2e/tags.spec.ts` (sélecteurs `getByPlaceholder` actuels) ;
- tests composant existants, à compléter avec `getByLabelText` :
  - `frontend/src/features/tags/ui/create-tag-dialog.test.tsx`
  - `frontend/src/features/categories/ui/category-list.test.tsx`
  - `frontend/src/features/recurring/ui/create-recurring-dialog.test.tsx`
  - `frontend/src/features/recurring/ui/recurring-transaction-list.test.tsx`
  - `frontend/src/features/accounts/ui/create-account-dialog.test.tsx`
  - `frontend/src/features/transactions/ui/transaction-form.test.tsx`

À créer (aucun test existant trouvé pour ces fichiers) : tests composant pour `create-category-dialog`, `tag-list`, `create-smart-rule-dialog`, `smart-rules-list`, `transaction-filters`, `import-mapping-step`, `import-upload-step`, `breakdown-tab`, et `account-form` s'il n'est pas couvert par `create-account-dialog.test.tsx`.
