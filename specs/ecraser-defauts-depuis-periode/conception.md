# Conception — Écraser les montants par défaut depuis une période

## Ce que ça calcule ou décide
Entrées : catégories du compte (`GET /budget-templates`), budgets de la période tels qu'enregistrés (saisies comprises). Sortie : la liste `items` (une ligne par catégorie du compte, montant en centimes signé) envoyée à `PUT /budget-templates`, écrite seulement après le succès de l'enregistrement de la période.

## L'algorithme
Fonction pure `buildTemplateItems(categoryIds, budgets)` dans `budget-draft.ts` :
1. `budgets` = la liste finale de la période : `buildBudgets(reference, drafts, directions)` s'il y a des saisies, sinon `reference` (budgets enregistrés).
2. Pour chaque catégorie du compte, dans l'ordre reçu : montant = `amountAllocated` du budget de même `categoryId`, sinon `"0"`.
3. Signe repris tel quel : aucun `abs`, aucune règle par type (virement ou non). Un budget négatif d'une catégorie non virement reste négatif.
4. Les budgets d'une catégorie absente de la liste du compte sont ignorés (pas de catégorie inventée).

Enchaînement `onOverwrite` dans `budgets-screen.tsx` :
1. Garde : sortie si `submittingRef.current` (double clic), si compte, période, budgets (`ready`) ou catégories du compte non chargés, ou si `hasErrors`. Le bouton est `disabled` dans les mêmes cas et pendant `isPending`. Rien n'est écrit dans ces cas.
2. `window.confirm(texte)` : refus = return, aucun appel, saisies conservées.
3. `submittingRef.current = true` (posé avant tout `await`).
4. Si `dirty` : `await saveBudgets({ budgets: full, expectedBudgets: reference })`. Échec : même traitement que `onSave` (409 `BUDGETS_CHANGED` → relecture + `rejected` + bandeau ; sinon `save_error`), **return sans toucher aux montants par défaut** (CA7). Succès : `reset()`.
5. Liste = `buildTemplateItems(categoryIds, dirty ? full : reference)`, calculée **avant** `reset()` (les budgets de la période enregistrée, pas l'état relu).
6. `await saveTemplates({ accountId, items })`. Échec : bandeau « période enregistrée, pas les montants par défaut » ; un nouveau clic réessaie (sans saisie, il ne refait que l'étape 6). Succès : toast de confirmation.
7. `finally` : `submittingRef.current = false`.

## Données et structure
- Logique pure et testable : `buildTemplateItems` dans `budget-draft.ts`. Elle ne lit rien d'autre que ses deux arguments.
- Orchestration : un seul handler dans `budgets-screen.tsx`, qui réutilise `useUpdatePeriodBudgets`, `useSaveBudgetTemplates`, `useBudgetTemplates` (liste des catégories). Aucun changement back ni migration.
- Écrit : `PUT /periods/:id/budgets` (si saisies), puis `PUT /:accountId/budget-templates` (un upsert, tout ou rien).

## Arrondis, limites et cas particuliers
- Centimes entiers sous forme de chaîne, jamais de flottant ; aucun calcul, seulement de la copie.
- Budget absent ou `"0"` = `"0"` (CA4). Virement sortant `"-5000"` reste `"-5000"` (CA5). Dépense non virement négative non modifiée : reste négative (hypothèse de la spec) ; si elle est saisie, `draftErrors` bloque déjà le négatif.
- Aucune période ou aucune catégorie chargée : bouton désactivé, `confirm` jamais appelé, aucun appel réseau.
- Double clic pendant l'envoi : le `ref` bloque le 2e passage, une seule séquence (deux appels au plus).
- Période clôturée : même chemin, `ClosedPeriodWarning` reste affiché (CA6).
- Limite connue : une catégorie créée entre la lecture et le clic n'est pas incluse ; une autre personne qui modifie sans saisie de ma part n'est pas détectée (spec).

## Exploitation
- Pas de nouveau log (hors périmètre) : les deux PUT apparaissent dans les journaux de l'API. Échecs visibles par bandeau.
- Retour arrière : revert du commit front. Les anciens montants par défaut ne sont pas sauvegardés (ressaisie sur `/budgets/fixed`).

## Alternative écartée
Nouvelle route back atomique (période + configuration dans une transaction) : plus robuste (pas d'état « période enregistrée, défauts non écrits »), mais nouvelle brique d'API hors périmètre ; le cas partiel est visible, réessayable et sans perte.

## Cas de test qui prouvent que c'est juste
Fonction pure (`budget-draft.test.ts`) :
| Entrées | Résultat attendu | Pourquoi ce cas |
| --- | --- | --- |
| catégories A,B,C ; budgets A=10000, B=2500 | A=10000, B=2500, C=0 | CA4 : absent = 0, toutes les catégories |
| budget B=0 | B="0" | CA4 : 0 reste 0 |
| virement V=-5000 | V="-5000" | CA5 : signe conservé |
| dépense non virement D=-300 | D="-300" | négatif repris tel quel |
| budget d'une catégorie absente du compte | ignoré | pas de catégorie inventée |
| saisie A=12,00 sur A=100,00 via `buildBudgets` | A=1200 | saisies comprises |
| aucune catégorie | liste vide | cas vide |

Enchaînement (`budgets-screen.test.tsx`, mocks des deux mutations) :
| Entrées | Résultat attendu | Pourquoi ce cas |
| --- | --- | --- |
| confirmation refusée, avec saisies | aucun appel ; saisies conservées | CA2 |
| saisies + confirmation | `saveBudgets` (avec `expectedBudgets`) appelé, puis `saveTemplates` après sa résolution | CA3 : ordre |
| sans saisie + confirmation | seul `saveTemplates` appelé | CA1/CA3 |
| `saveBudgets` rejette (409 puis erreur) | `saveTemplates` jamais appelé ; message habituel | CA7 |
| `saveTemplates` rejette | message « période enregistrée, pas les défauts » ; 2e clic réessaie | CA8 |
| période clôturée | même séquence, avertissement affiché | CA6 |
| aucune période / catégories non chargées | bouton désactivé, `confirm` non appelé, rien écrit | cas canard |
| deux clics rapides | une seule séquence (un appel de chaque) | double clic |
