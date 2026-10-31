# Uniformiser le sélecteur de catégorie (tri + recherche)

## Le problème
Choisir la catégorie d'une transaction se fait dans des listes qui ne se ressemblent pas : l'ordre est celui de l'API (non trié), il n'y a pas de recherche, et l'import a sa propre liste (libellé « Non catégorisé », pas de message si vide). L'utilisateur perd du temps à chercher une catégorie, surtout quand il en a beaucoup.

## Critères d'acceptation
- [ ] CA1 — Étant donné un compte avec plusieurs catégories, quand l'utilisateur ouvre le sélecteur (formulaire de transaction, filtres, récurrentes création/édition, règles intelligentes création/édition), alors les catégories sont en ordre alphabétique, accents et majuscules ignorés (« Épargne » entre « Divers » et « Fêtes », pas à la fin).
- [ ] CA2 — Étant donné un sélecteur ouvert, quand l'utilisateur tape du texte dans le champ de recherche, alors seules les catégories dont le nom contient ce texte restent affichées (accents et majuscules ignorés : « ele » trouve « Électricité »).
- [ ] CA3 — Étant donné une recherche sans résultat, quand la liste est vide, alors le message « Aucune catégorie trouvée » s'affiche.
- [ ] CA4 — Étant donné l'écran d'import (étape de validation), quand l'utilisateur ouvre le sélecteur d'une ligne, alors il voit le même sélecteur que partout : même tri, même recherche, même message vide, même libellé pour « pas de catégorie ».
- [ ] CA5 — Étant donné le formulaire de transaction, quand une catégorie est prédite à partir de la description, alors elle s'affiche dans le sélecteur (comme aujourd'hui).
- [ ] CA6 — Étant donné un import dont des lignes ont une catégorie prédite, quand l'étape de validation s'affiche, alors chaque catégorie prédite apparaît dans le sélecteur de sa ligne, et la modifier à la main reste possible.
- [ ] CA7 — Étant donné une liste triée ou filtrée, quand l'utilisateur choisit une catégorie ou « Aucune », alors c'est bien cette catégorie qui est enregistrée (ou aucune ; dans les filtres, « Aucune » revient à « Toutes les catégories »).

## Règle critique
Quel que soit le tri ou le filtre de recherche, la catégorie cliquée est celle qui est enregistrée, et la catégorie prédite ou déjà choisie reste affichée dans le sélecteur. Un décalage ici classerait des transactions dans la mauvaise catégorie sans que personne le voie. Testée avant le code.

## Mesure d'impact
- Indicateur qui doit bouger : temps gagné pour la saisie (trouver une catégorie plus vite).
- Équipe qui en profite : Performance.
- Comment on le mesure : aucun outil de mesure existant, et ce n'est pas proposé d'en ajouter pour ce cycle. Vérification à l'œil : chronométrer à la main le choix d'une catégorie « lointaine » dans la liste avant/après, sur un compte avec beaucoup de catégories. Pas de chiffre fiable en prod.

## Exploitation
- Rien de spécifique à observer (changement d'affichage uniquement, aucune donnée modifiée).
- Retour arrière : revert du commit ; aucune donnée à corriger.
- Feature flag : non.

## Parties sensibles
Aucune.

## Ce qui change dans l'existant
- Aucune règle de `docs/categories.md` contredite : l'API continue de renvoyer la liste sans tri (`docs/categories.md:36`), le tri se fait à l'affichage.
- À mettre à jour dans la doc (ligne « Écrans », `docs/categories.md:41`) : le sélecteur trie et propose la recherche, et l'import l'utilise.

## Fichiers concernés
- À modifier : `frontend/src/features/categories/ui/category-selector.tsx` — tri + recherche + message vide (composant commun, déjà utilisé par `transaction-form.tsx`, `transaction-filters.tsx`, `create-recurring-dialog.tsx`, `recurring-transaction-list.tsx`, `create-smart-rule-dialog.tsx`, `smart-rules-list.tsx` : ces six fichiers n'ont normalement pas à changer).
- À modifier : `frontend/src/features/transactions/ui/import/import-validation-step.tsx` — remplacer la liste ad hoc (l.68-92) par le sélecteur commun ; garder `predicted: false` quand l'utilisateur change à la main.
- À modifier : `frontend/messages/fr.json`, `frontend/messages/en.json` — clé du champ de recherche dans `Categories.selector` ; la clé `Import.validation.uncategorized` devient inutile si l'import adopte `Categories.selector.none`.
- Précédent dans le code pour une liste avec recherche : `frontend/src/features/tags/ui/tag-selector.tsx` (utilise `components/ui/command.tsx` et `popover.tsx`).
- Tests : `frontend/src/features/transactions/ui/import/import-validation-step.test.tsx` (à compléter) ; `frontend/src/features/transactions/ui/transaction-form.test.tsx` moque `CategorySelector` (l.8) : le test de CA5 devra utiliser le vrai composant ou être couvert à part.
- À créer : `frontend/src/features/categories/ui/category-selector.test.tsx` (aucun test existant du sélecteur, Glob vérifié) — CA1, CA2, CA3, CA7.

## Hors périmètre
- Détermination automatique de la catégorie (prédiction) : cycle séparé. Seule la non-régression d'affichage est exigée (CA5, CA6).
- Tri côté API.
- Les listes de catégories qui ne sont pas des listes déroulantes : cases à cocher de `category-filter-sidebar.tsx`, champs de budget par catégorie de `edit-period-budgets-sheet.tsx`.
- Les autres listes déroulantes (type de catégorie, compte, objectif d'épargne).

## Hypothèses
Validées par Lucas (go du 2026-10-31) :
- Tri : ordre alphabétique du français, sans distinction d'accents ni de casse.
- Recherche : « contient » (pas seulement « commence par »), mêmes règles accents/casse.
- Place de « Aucune » : toujours en premier, hors tri, comme aujourd'hui dans le sélecteur commun. Pendant une recherche, elle est masquée.
- Libellé : à l'import, « pas de catégorie » prend le libellé du sélecteur commun (`Categories.selector.none`, soit « Sans catégorie » en français — le mot « Aucune » du cadrage n'existe pas dans les messages) à la place de « Non catégorisé ».
- Recherche sans résultat : message existant « Aucune catégorie trouvée » (`Categories.selector.empty`), sans proposer de créer la catégorie.
- La recherche est vidée à chaque ouverture du sélecteur.
- Pas de mesure instrumentée (voir Mesure d'impact).

## Points ouverts
- Valider les hypothèses ci-dessus, en particulier le libellé à l'import et le masquage de « Aucune » pendant la recherche.
