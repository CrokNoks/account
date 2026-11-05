# Besoin — budgets-fixes-du-compte

Les montants proposés à la création d'une période doivent venir d'une configuration du compte (budget par catégorie fixe), au lieu de la moyenne historique des dépenses réelles. Ça évite les débordements de budget et permet de voir clairement les dépassements au lieu d'un ajustement automatique d'une période à l'autre.

## Réponses de Lucas (cadrage)
- Hypothèse confirmée par la question : un montant configuré l'emporte toujours, même sur la somme des récurrentes.
- Catégorie sans montant configuré : proposer **0** (plus de moyenne historique ni de repli sur les récurrentes).
- Point de départ, pour un compte qui a déjà des périodes : la configuration est **pré-remplie avec les budgets de la période la plus récente**, Lucas ajuste ensuite.
- Impact attendu : **les dépassements deviennent visibles** : le nombre de catégories en dépassement par période ne doit plus être absorbé par la moyenne. Mesure : requête SQL qui compare budgets et réel.

## Existant repéré
- La table `budget_templates` (account_id, category_id, amount_base en centimes BIGINT, is_fixed, UNIQUE(account_id, category_id), RLS par compte) existe en base, mais aucun code ne l'utilise (`docs/budgets.md`, zones d'ombre).
- Le plafond par catégorie (`categories.budget`) a été retiré au commit `4d18387` (« le budget est celui de la période »).

## Réponses de Lucas (questions du canard)
- La configuration se modifie dans un **écran dédié du compte** : la liste des catégories, chacune avec son montant fixe.
- La reprise se fait **par catégorie** : une catégorie sans ligne, ou avec une ligne à 0, est remplie avec le budget de la période la plus récente ; une ligne non nulle n'est jamais écrasée.
- Un compte sans aucune période, ou une catégorie créée après la reprise : on propose **0** tant que rien n'est configuré.

## Correction de Lucas (validation de la spec)
- « Une catégorie qui a que des récurrentes et aucun budget se voit proposer la somme des récurrentes en tant que configuration à sauvegarder. »
- Interprétation (confirmée par Lucas : « C'est ça ») : sur l'écran de configuration, une catégorie non configurée qui a des récurrentes est pré-remplie avec la somme de ses récurrentes ; rien n'est enregistré tant que Lucas n'enregistre pas. La création de période propose toujours 0 tant que la catégorie n'est pas configurée ; la reprise ne la touche pas.
