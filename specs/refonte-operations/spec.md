# Refonte Opérations — pointer en ligne, trois états, soldes à jour

## Le problème
Sur l'écran Opérations, une CB à pointer, une facture à venir et une opération pointée ne se distinguent pas (un simple rond, un filtre « Non pointées » qui mélange CB et factures), et les soldes ne sont pas sur l'écran. Depuis À traiter, on arrive sur la liste entière, sans filtre ni repère. Pointer coûte des allers-retours.

## Critères d'acceptation
- [ ] CA1 — Étant donné une opération, quand elle s'affiche, alors elle porte un seul état écrit en toutes lettres : « Pointée » si rapprochée (même si `pending`), sinon « Facture à venir » si `pending`, sinon « À pointer ». Une `pending` rapprochée est donc « Pointée ».
- [ ] CA2 — Étant donné le filtre d'état (Toutes / À pointer · N / Factures à venir / Pointées), quand j'en choisis un, alors la liste ne montre que cet état ; N est le « reste à pointer » de la période (même nombre que les CB à pointer d'Aujourd'hui) ; le filtre se combine avec dates, texte, catégorie, tags et montants.
- [ ] CA3 — Étant donné une opération « À pointer » ou « Facture à venir », quand je la pointe (une ligne, un geste, sans dialogue, en bureau comme en mobile, ou en lot), alors elle passe « Pointée » et les soldes de tête (en banque, à venir, reste à pointer) sont à jour sans recharger la page. Si l'envoi échoue (réseau), alors la ligne garde son état d'avant, un message d'erreur s'affiche, les soldes ne bougent pas et je peux réessayer.
- [ ] CA4 — Étant donné une facture à venir, quand je la pointe, alors elle sort de l'attente et le solde en banque baisse de son montant (règle `resolvePending` inchangée). Quand je la dépointe ensuite, alors elle redevient « À pointer », pas « Facture à venir » (`pending` n'est pas restaurée), un message me le dit, avec une action « Remettre en facture à venir ». Cette action, sur une ligne non rapprochée, la passe « Facture à venir » (elle reste non rapprochée) : elle sort du « reste à pointer » et du solde à venir, le solde en banque ne bouge pas, et les soldes de tête sont à jour sans recharger. Si l'envoi échoue, la ligne reste « À pointer » avec un message d'erreur.
- [ ] CA5 — Étant donné la période choisie, quand l'écran s'affiche, alors la liste démarre sur cette période, avec le même sélecteur qu'Aujourd'hui et une option « toutes les périodes » ; les soldes en tête reprennent les chiffres d'Aujourd'hui pour la période choisie (en banque, à venir, reste à pointer) ; ils suivent la période et le pointage, jamais les autres filtres de la liste. Sans période : à la place des soldes, une explication ; la liste reste utilisable.
- [ ] CA6 — Étant donné À traiter, quand je clique sur « CB à pointer », alors j'arrive sur Opérations avec le filtre « À pointer » déjà actif ; quand je clique sur une anomalie (doublon ou dépense inhabituelle), alors j'arrive sur Opérations filtrée sur exactement les transactions de l'anomalie (toutes périodes, sans filtre d'état) ; quand je clique sur un dépassement, alors j'arrive sur Opérations filtrée sur sa catégorie et la période choisie. Le filtre par identifiants est appliqué par le back, aux seules transactions du compte, avec la même validation d'UUID que les autres filtres de la liste : un identifiant invalide est refusé, un identifiant d'un autre compte ne renvoie rien.
- [ ] CA7 — Étant donné une anomalie non ignorée de la période, quand sa transaction s'affiche dans la liste, alors la ligne porte « Doublon possible » (anomalie `duplicate`, détection `findDuplicates` existante) ou « Dépense inhabituelle » (anomalie `outlier`), aucune nouvelle règle de détection ; ignorer l'anomalie retire la marque.
- [ ] CA8 — Étant donné l'écran, alors recherche et filtres existants, sélection et actions en lot, import et création d'opération restent disponibles ; tout le texte est en fr et en, lisible en clair et en sombre, bureau et mobile (le pointage reste en un geste dans la liste mobile).

## Règle critique
L'état affiché d'une opération (CA1) : rapprochée → « Pointée » ; sinon `pending` → « Facture à venir » ; sinon « À pointer ». La même définition sert l'étiquette, le filtre et le compte N ; si elle est fausse, on pointe ou on cache la mauvaise ligne. Testée avant le code (fonction pure, y compris `pending` + rapprochée).

## Mesure d'impact
- Indicateur qui doit bouger : part d'opérations pointées sans passer par un dialogue (plan `refonte-interface`).
- Équipe qui en profite : Performance.
- Comment on le mesure : par vérification (arriver depuis À traiter, pointer tout en ligne), sans suivi ajouté (décision de Lucas).

## Exploitation
- Rien de nouveau à suivre en prod ; erreurs de pointage via le toast d'erreur existant.
- Retour arrière : revert des commits locaux du cycle (aucune donnée ni schéma modifiés).
- Feature flag : non. Commits locaux, sans push, release ni db push avant la fin de la refonte.

## Parties sensibles
- État d'une opération — règle à branches avec priorité (rapprochée avant `pending`), définie deux fois (front pour l'étiquette, filtre côté liste pour le back) : petite fonction pure à valider avant le code. Gardée comme partie sensible.
- Aucun calcul d'argent ajouté : les soldes viennent des stats existantes, rechargées après le pointage. Un calcul côté front (mise à jour optimiste des soldes) deviendrait sensible : non retenu.

## Ce qui change dans l'existant
- Pas de contradiction avec une règle de `docs/` : `resolvePending` et les formules de soldes (`docs/reporting.md`) sont inchangées.
- Écart avec la maquette : elle ne laisse pointer que les CB ; ici on pointe aussi les factures à venir (réponse de Lucas dans `besoin.md`).
- Le filtre « Non pointées » (`reconciled=false`, mélange CB et factures) est remplacé par « À pointer » et « Factures à venir ». Le back ne sait filtrer que sur `reconciled` (`supabase-transaction.repository.ts:76,141`) : il faut un filtre `pending` sur la liste (cas d'usage de liste, DTO de requête).
- L'action en lot « rapprocher » ne recharge pas les stats aujourd'hui (`use-bulk-transactions.ts` n'invalide que `transactions`, contrairement à `use-update-transaction.ts`) : à corriger pour CA3.
- À traiter : les lignes CB et anomalies pointaient vers `/transactions` sans filtre ; elles portent désormais l'état voulu. Le dépassement pointait vers `/budgets` (`to-handle.tsx:74`) : il pointe désormais vers Opérations (réponse de Lucas).
- Le back ne filtre pas par identifiants : nouveau filtre `ids` sur la liste, mêmes règles d'accès (`account_id` du compte, `supabase-transaction.repository.ts:53`) et même validation que `tagIds` (`@IsUUID(undefined, { each: true })`, `transactions.controller.ts:305`), sans la contourner.

## Fichiers concernés
- Modifier : `frontend/src/features/transactions/ui/transaction-list.tsx` — état et filtre d'état, période de départ et « toutes les périodes », compte N, lecture des filtres venus du lien (état, identifiants, catégorie, période), message et action « Remettre en facture à venir » après dépointage
- Modifier : `frontend/src/features/transactions/ui/transaction-filters.tsx` — filtre d'état à 4 choix
- Modifier : `frontend/src/features/transactions/ui/transaction-table.tsx`, `transaction-mobile-list.tsx` — état écrit, pointage en un geste, marques « Doublon possible » et « Dépense inhabituelle »
- Modifier : `frontend/src/features/transactions/api/use-bulk-transactions.ts` — rafraîchir stats et anomalies après le lot
- Modifier : `frontend/src/features/transactions/model/types.ts` — options `pending` et `ids` de la liste
- Modifier : `frontend/src/app/[locale]/(dashboard)/transactions/page.tsx` — soldes en tête, titre, sélecteur de période
- Modifier : `frontend/src/app/[locale]/(dashboard)/page.tsx` — utiliser le sélecteur de période partagé (l.82)
- Modifier : `frontend/src/features/reporting/ui/to-handle.tsx`, `anomalies-widget.tsx` — cibles des liens (CB, anomalies par identifiants, dépassement par catégorie et période)
- Modifier : `frontend/messages/fr.json`, `en.json` — textes (espace `Transactions`)
- Modifier : `functions/src/transactions/infrastructure/transactions.controller.ts` (`FindTransactionsQueryDto`), `supabase-transaction.repository.ts` (liste paginée et non paginée), `domain/transaction.repository.interface.ts` — filtres `pending` et `ids`
- Créer : `frontend/src/features/transactions/model/operation-state.ts` — état d'une opération (Glob : absent) ; `frontend/src/features/periods/ui/period-select.tsx` — sélecteur de période partagé avec Aujourd'hui (Glob : absent) ; `frontend/src/features/transactions/ui/operations-balances.tsx` — soldes de tête (stats existantes) ; `functions/http/operations-pointage.http` — scénario réel
- Tests : `frontend/src/features/transactions/model/operation-state.test.ts` (créer), `ui/transaction-list.test.tsx`, `frontend/src/features/reporting/ui/to-handle.test.tsx`, `anomalies-widget.test.tsx`, `functions/src/transactions/infrastructure/supabase-transaction.repository.spec.ts`, `functions/test/transactions.e2e-spec.ts` (filtres `pending` et `ids` : UUID invalide refusé, autre compte exclu)
- Schéma : aucune migration (aucune colonne touchée). Next.js : lire `frontend/node_modules/next/dist/docs/` avant tout code de lecture d'URL (`frontend/CLAUDE.md`).

## Hors périmètre
Refonte de l'import, cycles 4 à 7, nouvelle règle de détection des anomalies, changement de `resolvePending` ou des formules de soldes.

## Hypothèses
- Les soldes lisent les stats de `activePeriodId` (le même que sur Aujourd'hui, `use-account-store.ts`) ; « reste à pointer » = `cardCount` / `cardTotal` des stats, montant signé comme dans À traiter (la maquette l'affiche positif).
- Une `pending` rapprochée existe bien : création avec les deux à vrai (`create-transaction.use-case.ts:40`, sans `resolvePending`) ou `pending: true` envoyé seul sur une ligne rapprochée (formulaire d'édition). Elle s'affiche « Pointée » et n'apparaît ni dans « À pointer » ni dans « Factures à venir » ; cohérent avec `docs/reporting.md` (une rapprochée n'a pas de ligne propre).
- « Doublon possible » et « Dépense inhabituelle » viennent des anomalies de la période (`transactionIds` des anomalies `duplicate` et `outlier`, hors ignorées, `reporting/model/types.ts:84-88`) : seules les transactions de la période d'analyse sont marquées. Les anomalies ne portent ni date ni montant exploitable, seulement des identifiants ; le lien d'anomalie passe donc par le filtre `ids`, toutes périodes.
- Le lien d'un dépassement garde la liste sans filtre d'état : le dépassement d'À traiter compte les `pending` (`docs/reporting.md`), la liste doit les montrer.
- « Remettre en facture à venir » envoie `pending: true` seul sur la ligne non rapprochée : `resolvePending` la garde non rapprochée et `pending` (`pending-rule.ts:8-13`), règle inchangée. L'action n'est proposée que sur une ligne non rapprochée, juste après le dépointage.
- Le compte N du filtre suit la période, pas les filtres de la liste (comme les soldes).
- Aucun test e2e en réel possible avant la fin : les vérifications des cycles 1 et 2 restent non faites (choix de Lucas).

## Décisions de Lucas
- Message de dépointage et action « Remettre en facture à venir » : seulement pour une ligne pointée depuis « Facture à venir » pendant la session de l'écran. Après un rechargement, le message ne s'affiche plus.
