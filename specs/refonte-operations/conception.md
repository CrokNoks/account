# Conception — état d'une opération et concordance front / back

## Ce que ça décide
Entrée : `reconciled` et `pending` d'une opération. Sortie : un seul état (`pointee` | `a_venir` | `a_pointer`) pour l'étiquette, et la requête de liste (`reconciled`, `pending`) qui sélectionne exactement les lignes de cet état.

## L'algorithme
```
operationState(t):
  if t.reconciled  -> 'pointee'      // prioritaire, même si pending
  if t.pending     -> 'a_venir'
  else             -> 'a_pointer'

stateFilterToQuery(f):               // f = all | a_pointer | a_venir | pointee
  all       -> {}
  a_pointer -> { reconciled: false, pending: false }
  a_venir   -> { reconciled: false, pending: true }
  pointee   -> { reconciled: true }  // pending volontairement NON envoyé
```

Table des 4 combinaisons :

| reconciled | pending | État affiché | Dans quel filtre | Dans N (cardCount) |
| --- | --- | --- | --- | --- |
| faux | faux | À pointer | À pointer | oui |
| faux | vrai | Facture à venir | Factures à venir | non |
| vrai | faux | Pointée | Pointées | non |
| vrai | vrai | Pointée (pending rapprochée) | Pointées seulement | non |

## Données et structure
- Front : `frontend/src/features/transactions/model/operation-state.ts`, deux fonctions pures (`operationState`, `stateFilterToQuery`), moins de 40 lignes. Étiquette, filtre, pointage en ligne et en lot les utilisent ; plus aucun `t.reconciled ? … : …` dans l'UI.
- Back : aucune fonction d'état. Le filtre est la combinaison de deux `eq` indépendants (`reconciled`, nouveau `pending`) dans `supabase-transaction.repository.ts`, liste paginée et non paginée. Un filtre de plus, pas une seconde définition de l'état : c'est le front qui choisit quels paramètres envoyer.
- N : `cardCount` des stats existantes (non rapprochées et non `pending`, `docs/reporting.md`) = exactement la ligne « À pointer ». Aucun calcul ajouté.
- Fichiers de la partie sensible : `operation-state.ts`, `operation-state.test.ts`, et dans le back le seul ajout `pending` (DTO `FindTransactionsQueryDto`, interface du dépôt, deux `eq`). Le reste (UI, `ids`, liens) n'est pas sensible.
- Rien n'est écrit en base ; `resolvePending` inchangé (le dépointage n'envoie que `reconciled: false`, « Remettre en facture à venir » que `pending: true`).

## Limites et cas particuliers
- Priorité : rapprochée avant `pending`. C'est la raison pour laquelle « Pointées » n'envoie pas `pending` : l'envoyer à faux exclurait la pending rapprochée.
- « À venir » doit envoyer `reconciled: false` : sinon la pending rapprochée y serait comptée.
- Valeurs absentes : un champ non booléen (donnée ancienne) est traité comme faux.
- Pas de montants dans cette partie.

## Garantir que front et back ne divergent pas
1. Une même table de 4 lignes (ci-dessus) écrite dans les deux suites de tests, avec le même nom de cas.
2. Front (`operation-state.test.ts`) : pour chaque ligne, `operationState` donne l'état attendu, et un petit filtre en mémoire qui applique `stateFilterToQuery(f)` aux 4 combinaisons garde exactement les lignes de l'état `f` (l'état d'une ligne est dans le filtre de son état, et dans aucun autre).
3. Back (`supabase-transaction.repository.spec.ts` + e2e) : avec les 4 combinaisons créées par l'API, `reconciled=false&pending=false`, `reconciled=false&pending=true`, `reconciled=true` renvoient exactement les lignes de la table ; la liste paginée et la non paginée donnent le même résultat.
4. Cohérence avec N : test e2e ou spec qui vérifie que le nombre de lignes « À pointer » d'une période = `cardCount` des stats.

## Exploitation
Pas de log ni de flag (spec : rien à suivre). Retour arrière : revert des commits locaux du cycle ; aucune donnée ni schéma touchés.

## Alternative écartée
Un paramètre unique `state=a_pointer|a_venir|pointee` et l'état calculé aussi côté back (deux définitions, deux tests, plus de code). Écartée : les deux booléens existent déjà en colonnes, le filtre `pending` suffit, et la définition de l'état reste en un seul endroit (front).

## Cas de test écrits avant le code
| Entrées | Résultat attendu | Pourquoi ce cas |
| --- | --- | --- |
| `reconciled` faux, `pending` faux | état `a_pointer` | cas de base (CB) |
| faux, vrai | `a_venir` | facture à venir |
| vrai, faux | `pointee` | cas de base pointé |
| vrai, vrai | `pointee` (pas `a_venir`) | pending rapprochée : priorité (CA1) |
| filtre `a_pointer` sur les 4 combinaisons | seule (faux, faux) | pas de mélange CB / factures |
| filtre `a_venir` sur les 4 | seule (faux, vrai) | exclut la pending rapprochée |
| filtre `pointee` sur les 4 | (vrai, faux) et (vrai, vrai) | la pending rapprochée reste dans « Pointées » |
| filtre `all` | `{}` (4 lignes) | pas de paramètre |
| `stateFilterToQuery('pointee')` | ne contient pas la clé `pending` | évite d'exclure la pending rapprochée |
| champ absent ou non booléen | traité comme faux | donnée ancienne |
| back : `pending=true` seul | toutes les pending, rapprochées comprises | `eq` indépendant |
| back : `reconciled=false&pending=false` | seulement (faux, faux), même en paginé et non paginé | concordance avec le front |
| back : `pending=maybe` | 400 | validation booléenne comme `reconciled` |
| back : stats d'une période vs lignes « À pointer » | `cardCount` = nombre de lignes | N identique au filtre |

## Doutes
- N suit la période, la liste suit les dates : si l'utilisateur change les dates, le « N » du filtre peut différer du nombre de lignes affichées. Voulu par la spec (hypothèse), je ne le corrige pas.
- Les cas back qui lisent les stats d'une période demandent une base de test (e2e) ; si elle n'est pas disponible, ces deux lignes ne seront couvertes que par spec avec dépôt simulé.
