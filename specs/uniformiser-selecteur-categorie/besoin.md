# Besoin (Lucas, tel quel)

il y a un problème à corriger dans le front uniquement. la liste des catégories associé à une transaction n'est pas la même partout. il faudrait l'uniformiser : vu que c'est un select, un champs de recherche est à mettre en place, il faut trier les éléments par ordre alpahabetique. precise moi si la détermination auto de la catégorie peut faire parti de ce cycle

## Réponses de Lucas (cadrage)

- Périmètre : **partout** où une catégorie se choisit dans une liste déroulante (formulaire de transaction, import CSV, récurrentes, filtres, règles intelligentes).
- Détermination automatique de la catégorie : **hors cycle**. Elle existe déjà ; le prochain travail sera de l'affiner et de corriger un bug de détermination (cycle séparé).
- Impact attendu : **temps gagné pour la saisie** (trouver une catégorie plus vite grâce à la recherche et au tri).

## Constat (orchestrateur)

- Composant commun `frontend/src/features/categories/ui/category-selector.tsx` : pas de recherche, ordre de l'API (non trié, `docs/categories.md:36`). Utilisé par `transaction-form`, `transaction-filters`, `create-recurring-dialog`, `recurring-transaction-list`, `create-smart-rule-dialog`, `smart-rules-list`.
- Liste ad hoc dans `frontend/src/features/transactions/ui/import/import-validation-step.tsx:68-92` (libellé « Non catégorisé » au lieu de « Aucune », pas d'état vide).
