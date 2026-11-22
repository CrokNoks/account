# Besoin

Accessibilité des formulaires : lier chaque libellé à son champ (htmlFor/id ou label englobant) dans les formulaires restants du front — tags (create-tag-dialog, tag-list), categories (create-category-dialog, category-list), recurring (create-recurring-dialog, recurring-transaction-list), smart-rules (create-smart-rule-dialog, smart-rules-list), accounts (account-form), transactions (transaction-form, transaction-filters, import-mapping-step, import-upload-step), reporting (breakdown-tab, peut-être déjà correct). Même correctif que 3e43e0b sur les tiroirs de période.

## Réponses de Lucas

- Impact : nombre de champs de formulaire avec un libellé visible non lié = 0 ; mesuré par les tests composant (getByLabelText) et les parcours e2e qui trouvent les champs par leur libellé.
- Périmètre strict : uniquement les libellés visibles existants, liés à leur champ. Pas de nom accessible ajouté aux champs sans libellé visible (recherche, cases de sélection…).
- Parcours e2e : inclus — les parcours e2e existants trouvent les champs de ces formulaires par leur libellé (getByLabel) au lieu de sélecteurs techniques.
- Mode : express.
