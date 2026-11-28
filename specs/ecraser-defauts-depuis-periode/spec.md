# Écraser les montants par défaut depuis une période

## Le problème
Après l'ouverture d'une nouvelle période, Lucas corrige à la main des budgets, parce que les montants par défaut du compte (« Montants par défaut des nouvelles périodes ») ne suivent pas ses corrections. Pour que la période suivante parte juste, il doit ressaisir les mêmes montants sur l'écran des montants par défaut.

## Critères d'acceptation
- [ ] CA1 — Étant donné l'écran Budgets (`/budgets`), quand une période est choisie (en cours ou clôturée), alors un bouton « montants par défaut » est visible, avec ou sans saisie en cours.
- [ ] CA2 — Étant donné un clic sur le bouton, quand la confirmation est refusée, alors rien n'est écrit : ni budgets de la période, ni montants par défaut, et les saisies en cours restent.
- [ ] CA3 — Étant donné des saisies non enregistrées et une confirmation acceptée, quand l'opération se déroule, alors les saisies sont d'abord enregistrées dans les budgets de la période (même règle que « Enregistrer », y compris le contrôle `BUDGETS_CHANGED`), puis les montants de la période enregistrée deviennent les montants par défaut du compte.
- [ ] CA4 — Étant donné une catégorie du compte sans budget dans la période (ou à 0), quand on écrase, alors son montant par défaut passe à 0. Les catégories budgétées prennent le montant de la période.
- [ ] CA5 — Étant donné un virement budgété en sortant (négatif), quand on écrase, alors son montant par défaut garde son signe (sens conservé).
- [ ] CA6 — Étant donné une période clôturée, quand on écrase après confirmation, alors ça fonctionne comme pour une période en cours (l'avertissement « période fermée » reste affiché).
- [ ] CA7 — Étant donné un échec de l'enregistrement de la période (409 `BUDGETS_CHANGED`, erreur, lecture seule), quand on écrase, alors les montants par défaut ne sont pas touchés et le message habituel s'affiche.
- [ ] CA8 — Étant donné un échec d'écriture des montants par défaut après l'enregistrement de la période, alors un message dit que la période est enregistrée mais pas les montants par défaut ; un nouveau clic réessaie. En cas de succès, un message de confirmation s'affiche et les périodes déjà créées ne changent pas.

## Règle critique
Les montants par défaut du compte reçoivent exactement les montants de la période **tels qu'enregistrés** (saisies comprises), pour **toutes** les catégories du compte : budget absent ou 0 = 0, signe repris tel quel. La configuration n'est écrite qu'après le succès de l'enregistrement de la période. Test écrit avant le code sur la construction de la liste (fonction pure du front) puis sur l'ordre des appels.

## Mesure d'impact
- Indicateur qui doit bouger : nombre de périodes dont les budgets sont corrigés à la main après l'ouverture (à la baisse).
- Équipe qui en profite : Performance.
- Comment on le mesure : requête en lecture seule `supabase/queries/budgets-corriges-apres-ouverture.sql` : par période, les budgets recréés après l'ouverture (le remplacement supprime puis recrée tous les budgets : `created_at` des budgets postérieur à celui de la période). Comparaison avant / après la mise en service. Mesure approchée (voir Hypothèses).

## Exploitation
- Ce qu'on doit pouvoir voir en prod : échecs visibles à l'écran (message) ; appels `PUT /budget-templates` et `PUT /periods/:id/budgets` dans les journaux de l'API existants.
- Retour arrière : revert du commit front (aucun changement back, aucune migration). Données : les anciens montants par défaut ne sont pas sauvegardés ; les ressaisir sur `/budgets/fixed`.
- Feature flag : non (bouton derrière une confirmation, front seul).

## Parties sensibles
- Écriture en masse des montants par défaut — écrase la configuration de toutes les catégories d'un compte sans sauvegarde, et les montants de la période sont copiés tels quels (signe compris). Validation de la conception avant le code, du code avant le commit.

## Ce qui change dans l'existant
- Change la règle de `docs/periods.md` (Écran Budgets, « Saisie ») « rien n'est écrit avant « Enregistrer » » : ce bouton écrit aussi, après confirmation.
- Complète « Le brouillon ne modifie jamais la configuration… » (`docs/periods.md`) : ce bouton devient le seul geste, hors écran `/budgets/fixed`, qui modifie les montants par défaut.
- Vocabulaire (`docs/budgets.md`, test `vocabulary.test.ts`) : le libellé dit « montants par défaut », jamais « budgets fixes ».
- Pas de changement des routes ni de la règle « changer la configuration ne change pas les budgets des périodes déjà créées ».
- Chemins d'exposition : aucune règle de visibilité en jeu (le droit d'écriture reste celui de la RLS, lecteur partagé = refus, couvert par CA7/CA8).

## Fichiers concernés
- À modifier : `frontend/src/features/budgets/ui/budgets-screen.tsx` — bouton toujours visible, confirmation (`confirm`, comme `period-list.tsx:49`), enchaînement enregistrement puis écriture
- À modifier : `frontend/src/features/budgets/model/budget-draft.ts` — construction de la liste des montants par défaut (catégories du compte, 0 si absent)
- À modifier : `frontend/messages/fr.json`, `frontend/messages/en.json` — textes (espace `BudgetsScreen`)
- Réutilisés sans modification : `frontend/src/features/periods/api/use-save-budget-templates.ts`, `use-budget-templates.ts` (liste des catégories du compte), `use-update-period-budgets.ts`
- Tests : `frontend/src/features/budgets/model/budget-draft.test.ts`, `frontend/src/features/budgets/ui/budgets-screen.test.tsx`, `frontend/src/features/budgets/ui/vocabulary.test.ts` (vérifier le libellé)
- À créer : `http/ecraser-defauts.http` — scénario réel (PUT budgets puis PUT budget-templates, lecture du brouillon) ; `supabase/queries/budgets-corriges-apres-ouverture.sql` — mesure
- Back, base : aucun changement (pas de migration).

## Hors périmètre
- Écraser seulement certaines catégories ; annuler l'écrasement ; sauvegarde des anciens montants par défaut.
- Modifier les budgets des autres périodes.
- Ajouter un log ou un événement d'usage du bouton.
- Rendre la séquence atomique côté API (nouvelle route).

## Hypothèses
- Non confirmé par Lucas (décisions déléguées, option la plus simple et sûre) :
  - Le bouton est visible même sans saisie ; il n'est désactivé que pendant un envoi, tant que les budgets ou les catégories ne sont pas chargés, ou si une saisie est invalide (comme « Enregistrer »).
  - Confirmation par `window.confirm`, comme les autres confirmations du projet ; le texte dit que les montants par défaut de toutes les catégories seront remplacés et que les saisies en cours seront enregistrées dans la période.
  - Deux appels existants à la suite (période, puis configuration), sans nouvelle route : si le second échoue, la période reste enregistrée (CA8). Le second appel est un seul upsert, tout ou rien.
  - La liste des catégories vient de `GET /budget-templates` (toutes les catégories du compte, `docs/periods.md`) ; une catégorie créée entre-temps n'est pas incluse.
  - Signe repris tel quel, comme la bascule (`docs/budgets.md`) ; un budget négatif de dépense non modifié reste négatif dans les montants par défaut.
  - La mesure ne distingue pas une correction d'un budget d'une correction de plusieurs, ni une correction manuelle d'un usage du bouton ; les périodes à enregistrement sans changement sont comptées comme corrigées.
- L'écrasement pendant qu'une autre personne modifie la période : couvert seulement par `expectedBudgets` à l'étape 1 ; sans saisie, la liste copiée est celle affichée.

## Points ouverts
Aucun.
