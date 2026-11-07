# Conception : montant signé de la saisie mobile et envoi unique

## Écart avec la spec (à acter)
La « Règle critique » dit « 1,005 → 101 ». Décision de Lucas : plus de 2 décimales = refus avec message, jamais d'arrondi. **1,005 est donc refusé, rien n'est envoyé.** Le cas « 1,005 → 101 » de la spec est remplacé par « 1,005 → refus ». Je ne modifie pas la spec (hors mon périmètre) : à corriger par le cadreur. Le test existant de `format.ts` (`toCents('1.005')` = '101', l.87) **reste vrai** : le bureau et les autres écrans (comptes, budgets, récurrences, import) continuent d'arrondir. Seule la saisie mobile refuse.

## Ce que ça décide
(saisie texte, sens Dépense/Revenu) → soit un montant en centimes signé (chaîne d'entier), soit un refus (rien n'est envoyé, message). Plus : une seule opération créée par intention d'envoi.

## L'algorithme
Fonction pure `toEntryCents(input, direction)` dans `features/transactions/model/entry-amount.ts` :
1. Lire la saisie avec le lecteur existant (`parseAmountToCents` : virgule/point, milliers, `€`/EUR, espaces insécables, lettres = illisible). Pas de second lecteur.
2. Saisie vide (après trim) → `{ status: 'empty' }` (le bouton reste désactivé comme aujourd'hui, pas de message).
3. Lecteur renvoie `null` → `{ status: 'unreadable' }` (message `Common.invalid_amount`, existant).
4. Plus de 2 décimales → `{ status: 'too_many_decimals' }` (nouveau message fr/en, clé `Transactions.amount_too_many_decimals`).
5. Valeur absolue (un « - » tapé, en tête ou en queue, est ignoré).
6. Plus grand que le plafond → `{ status: 'too_large' }`.
7. Signe : `expense` → `-abs`, `income` → `+abs`. Retour `{ status: 'ok', cents: string }`.
Virement : `toAbsCents` existant (valeur absolue, sens sans effet), avec les mêmes refus 3, 4 et 6 : je réutilise la même fonction avec `direction = 'transfer'` (retourne `+abs`).

## Comment détecter « plus de 2 décimales » sans dupliquer le lecteur
`parseAmountToCents` décide seul quel séparateur est décimal (« 1.234 » = décimal ; « 1.234.567 » = milliers ; les deux = le dernier). Le recopier dans `entry-amount.ts` créerait deux lecteurs qui divergent. **Proposition** : dans `format.ts`, extraire la partie « découpe » (signe, partie entière, partie décimale brute) dans une fonction interne exportée `splitAmount(input)` ; `parseAmountToCents` l'appelle, comportement identique (garanti par les tests existants de `format.test.ts`) ; `entry-amount.ts` lit la longueur de la partie décimale brute. Écart de fichiers : `shared/lib/format.ts` (+ `format.test.ts`) s'ajoute à la liste. Alternative sans toucher à `format.ts` : regex locale sur le texte nettoyé, plus petite mais seconde logique de séparateur (écartée). Conséquence à connaître : « 1.234 » tapé au point (milliers à l'anglo-saxonne) est lu comme 1,234 donc **refusé** : sûr, jamais un montant faux.

## Envoi unique
Cause actuelle : `isPending` ne passe à vrai qu'au rendu suivant, et la touche Entrée (`handleKeyDown`) ne le teste pas ; deux touches rapprochées lancent deux `mutate`.
1. Un verrou synchrone `useRef(false)` dans `CreateTransactionDrawer.handleSubmit` (point commun de « Ajouter », « Ajouter et en saisir une autre » et Entrée, bureau compris). Si verrouillé → retour immédiat, sans appel ni message.
2. Pose du verrou juste après la validation du montant (un refus de saisie ne verrouille pas), avant `mutate`.
3. Libération dans `onSettled` du `mutate` (succès comme erreur) : après une erreur serveur la saisie reste intacte (le formulaire n'est remis à zéro que dans `onSuccess`, déjà le cas) et on peut réessayer.
4. `handleKeyDown` du formulaire : sur mobile (largeur < `lg`, `matchMedia`) Entrée n'envoie rien ; partout, Entrée est ignorée si `isPending`. Les boutons restent `disabled={isPending}`.
5. Échec réseau (pas de réponse) : `onSettled` libère ; le message d'erreur global existant s'affiche ; pas de nouvel essai automatique. Limite : si la réponse est perdue alors que le serveur a créé l'opération, un second appui crée un doublon. Pas de clé d'idempotence côté back (hors périmètre, front seul). À signaler à Lucas.

## Arrondis, limites, cas particuliers
- Unité : centimes entiers, `bigint` en interne, chaîne à l'envoi. Aucun `Number`/`parseFloat`.
- Plafond (hypothèse à valider) : 999 999 999 999 centimes (9 999 999 999,99 €). La colonne est `BIGINT` (max ≈ 9,2e18) et le lecteur n'a pas de limite : sans plafond, un montant énorme part au back et échoue ou fausse les sommes. Le plafond est une constante nommée du module.
- Montant 0 : accepté (spec). « -0 » → 0, signe sans effet.
- `AmountInput` : aujourd'hui `inputMode="text"` fixé, avec `Omit<…, "inputMode">` (`amount-input.tsx`) : le « - » est tapable au bureau. **Réutilisé, pas dupliqué** : ajouter une prop `variant?: 'signed' | 'unsigned'` (défaut `signed` = comportement actuel inchangé) ; `unsigned` pose `inputMode="decimal"`. Le commentaire du fichier (« jamais decimal ») est mis à jour : levée pour `unsigned` seulement. Le clavier décimal iOS n'a pas toujours la virgule selon la langue : d'où le lecteur tolérant (point accepté). Non testable sur appareil ici.
- Choix du champ selon la largeur : le formulaire mobile et le formulaire bureau sont deux mises en page du même `TransactionForm` ; le montant mobile utilise `unsigned` + `direction`, le bureau garde `signed` + `toCents`. Un seul état `amount` (texte) et un seul état `direction`.

## Données et structure
- Logique pure : `features/transactions/model/entry-amount.ts` (moins de 60 lignes), sans React.
- Appelée par `create-transaction-drawer.tsx` (calcul du montant avant `mutate`) : mobile → `toEntryCents`, bureau → chemin actuel (`isUnreadableAmount`/`toCents`/`toAbsCents`) inchangé.
- Le drawer lit `direction` (nouvelle valeur de `TransactionFormValues`, `'expense'` par défaut) ; bureau l'ignore.

## Exploitation
- Pas de donnée personnelle dans les logs. Un `console.warn` n'est pas ajouté (la spec n'impose aucun log) ; le refus se voit par le message à l'écran.
- Retour arrière : `git revert` des commits front (aucune donnée écrite autrement qu'avant). Pas de feature flag (spec).

## Alternative écartée
Arrondir comme le bureau (1,005 → 101) : écarté par Lucas. Rejouer `toCents` sur la saisie mobile sans garde : un chiffre silencieusement faux. Désactiver le bouton pendant l'envoi seulement (`isPending`) : insuffisant, le rendu arrive après le second appui.

## Fichiers occupés
- Créer : `frontend/src/features/transactions/model/entry-amount.ts`, `entry-amount.test.ts`.
- Modifier : `frontend/src/shared/lib/format.ts` + `format.test.ts` (extraction de `splitAmount`, **hors liste de la spec**, si la proposition est acceptée) ; `frontend/src/components/ui/amount-input.tsx` (prop `variant`) ; `features/transactions/ui/create-transaction-drawer.tsx` (verrou, calcul du montant) ; `transaction-form.tsx` (sens, Entrée mobile / en cours d'envoi) ; `frontend/messages/fr.json`, `en.json` (`Transactions.amount_too_many_decimals`, plafond si message dédié : réutiliser un message `amount_too_large`).
- Tests à écrire/adapter : `entry-amount.test.ts` (nouveau), `create-transaction-drawer.test.tsx`, `transaction-form.test.tsx`, `transaction-form.add-another.test.tsx`.

## Cas de test écrits avant le code
`toEntryCents(saisie, sens)` :
| Entrées | Résultat attendu | Pourquoi |
| --- | --- | --- |
| `"12,50"`, expense | `"-1250"` | règle critique, virgule |
| `"12,50"`, income | `"1250"` | signe donné par le sens |
| `"12.50"`, expense | `"-1250"` | point |
| `"1 234,56"` / `"1 234,56"` (insécable), expense | `"-123456"` | milliers par espace |
| `"1.234,56"`, `"1,234.56"`, expense | `"-123456"` | milliers + décimale, le dernier séparateur gagne |
| `"1.234.567"`, expense | `"-123456700"` | séparateur répété = milliers |
| `"12,50 €"`, `"€12,50"`, `"12,50 EUR"` | `"-1250"` | symbole/devise ignorés |
| `"0,5"`, expense | `"-50"` | une décimale, pas 5 centimes |
| `"0,05"` | `"-5"` | zéro initial |
| `"12"` | `"-1200"` | entier |
| `",5"` | `"-50"` | partie entière absente |
| `"1,005"`, `"1.005"`, `"12,999"` | `too_many_decimals`, rien envoyé | décision de Lucas, jamais d'arrondi |
| `"1,230"` | `too_many_decimals` | troisième décimale nulle : refusé aussi (règle simple et prévisible) |
| `"-12,50"`, `"12,50-"`, `"−12,50"` (U+2212), expense | `"-1250"` | « - » tapé ignoré |
| `"-12,50"`, income | `"1250"` | idem, signe du sens seulement |
| `""`, `"   "` | `empty` | pas de message, bouton désactivé |
| `"abc"`, `"12abc"`, `"1e5"`, `"--"`, `"12-3"`, `","`, `"1,2,3,4,5"` | `unreadable` | illisible = rien envoyé |
| `"9999999999,99"` | `ok` (`"-999999999999"`) | borne haute incluse |
| `"10000000000"` (euros), `"99999999999999999999"` | `too_large` | plafond, pas de BigInt géant envoyé |
| `"0"`, `"-0"`, income/expense | `"0"` | montant 0 accepté, jamais « -0 » |
| `"12,50"`, transfer (avec ou sans `-`) | `"1250"` | virement en valeur absolue |

Envoi (tests de composant, drawer + form) :
| Scénario | Attendu |
| --- | --- |
| Deux clics rapprochés sur « Ajouter » (mutation encore en attente) | un seul `mutate` |
| Entrée puis Entrée pendant l'envoi (bureau) | un seul `mutate` |
| Entrée sur mobile (`matchMedia` < lg) | aucun `mutate` |
| « Ajouter et en saisir une autre » puis clic sur « Ajouter » immédiat | un seul `mutate` |
| Erreur serveur | message affiché, champs et sens intacts, verrou libéré, un nouvel appui envoie |
| Succès avec « autre » | formulaire remis à zéro : date du jour, Dépense, Plus d'options replié ; envoi suivant possible |
| Saisie illisible ou à 3 décimales | message, aucun `mutate`, verrou non posé (corriger puis renvoyer fonctionne) |
| Dépense 12,50 / Revenu 12,50 (corps de la requête) | `amount: "-1250"` / `"1250"` ; bureau `"-12,50"` → `"-1250"` inchangé |
| Virement `12,50` ou `-12,50` | `amount: "1250"` |

## Doutes à trancher par Lucas
1. Plafond de 9 999 999 999,99 € : valeur inventée, à confirmer ou changer.
2. Extraction de `splitAmount` dans `format.ts` (fichier partagé, hors liste) : go, ou regex locale ?
3. « 1,230 » refusé aussi (3 décimales même nulles) : OK ?
4. Doublon possible si la réponse du serveur est perdue (pas de clé d'idempotence) : accepté ?
5. Test réel du clavier `decimal` sur iOS/Android impossible ici.
