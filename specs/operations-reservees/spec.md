# Spec — operations-reservees

Mode complet. Sources : `besoin.md` (accord de Lucas du 2026-11-24 : « point ouvert 1 » de `specs/factures-reservees/spec.md`), `docs/transactions.md`, `docs/reporting.md`, code (`transactions.controller.ts:436-449`, `supabase-transaction.repository.ts:41-180`, `reporting/domain/period-window.ts`, front `transaction-list.tsx`).

## Objectif
Aujourd'hui, la liste d'Opérations d'une période coupe tout ce qui est daté après la fin (`transactions.controller.ts:447-448` pose `endDate` = fin de la période, `repository:58-60` fait `date <= fin`). Une CB non pointée datée après la fin de la période active est comptée dans « À pointer · n » (`cardCount`, `forecast-composition.ts:44-51`) et dans « CB à pointer » de À traiter, mais le lien (`to-handle.tsx:67` → `/transactions?state=a_pointer`) ne la montre pas. La liste d'une période doit contenir exactement ce que compte le prévu.

## Ce que ça change dans l'existant
- Les dates saisies avec `periodId` ne sont plus ignorées : elles restreignent la fenêtre (correctif ultérieur, `docs/transactions.md` l.50). Seule la fenêtre des dépenses réservées s'ajoutait dans ce cycle.
- Applique à la liste `isInPeriodWindow` (`docs/reporting.md` l.11) : pour une période **active**, les dépenses (montant < 0) datées après sa fin y figurent. Ne change aucune règle de `docs/reporting.md` ni aucun chiffre.
- Ne change pas : détail d'un tag (hors périmètre, `besoin.md`), soldes de tête, « À pointer · n », prévu, budgets, calendrier.

## Règle de fenêtre appliquée à la liste
Quand `periodId` est donné, la liste contient les transactions du compte telles que : date ≥ début de la période, et (période sans fin, ou date ≤ fin, ou **période active et montant < 0**). C'est `isInPeriodWindow` mot pour mot.
Avec `periodId`, `startDate` / `endDate` saisis restreignent la fenêtre de la période (ET, jamais un élargissement ; sans date saisie, rien ne change ; début > fin : liste vide) — décision postérieure : ils étaient ignorés à la première version. Les autres filtres (recherche, catégorie, tags, montants, état, `ids`) restreignent la fenêtre.
Sans `periodId` (« toutes les périodes ») : aucune fenêtre, seuls les filtres de l'utilisateur s'appliquent, comme aujourd'hui.

## Critères d'acceptation
1. **La liste de la période active = les opérations comptées par le prévu.** Une dépense (montant < 0, avec ou sans catégorie, `pending` ou non, pointée ou non) datée après la fin de la période active apparaît dans la liste de cette période. Une dépense datée avant le début n'y est pas.
2. **« À pointer · n » = la liste « À pointer ».** Sur la période active, le nombre `n` affiché (`cardCount`) est égal au total (`meta.total`) de la liste filtrée « À pointer » (`reconciled=false&pending=false`), CB datées après la fin comprises. Le lien « CB à pointer » de À traiter ouvre donc une liste qui contient toutes les CB comptées. (Indicateur de la mesure.)
3. **Ce qui reste exclu.** Période active : un revenu ou tout montant ≥ 0 daté après la fin n'est pas listé. Période fermée : rien de daté après sa fin n'est listé, dépense comprise. Période sans fin : tout ce qui est daté depuis le début.
4. **Pagination, total et tri cohérents.** `meta.total` et `meta.totalPages` comptent la même fenêtre que les lignes affichées ; aucune ligne n'apparaît deux fois ni ne manque en passant d'une page à l'autre, y compris quand plusieurs opérations ont la même date ; l'ordre reste date décroissante (les dépenses réservées, plus récentes, ouvrent la liste).
5. **Les filtres se combinent avec la fenêtre.** Recherche texte, catégorie, tags, montants min/max et état (Toutes / À pointer / Factures à venir / Pointées) ne font que restreindre la fenêtre : jamais une opération hors fenêtre ne réapparaît à cause d'un filtre, et jamais une opération de la fenêtre ne disparaît sans qu'un filtre la écarte. En particulier la recherche texte et la fenêtre de la période active s'appliquent **ensemble** (une dépense réservée dont le libellé ne correspond pas à la recherche n'est pas listée ; une qui correspond l'est).
6. **Filtre `ids` (liens de À traiter, anomalies) : jamais un autre compte.** Avec `ids`, la liste ne contient que des transactions du compte de l'URL, quelle que soit la période demandée ; un identifiant d'un autre compte est ignoré (liste sans lui), sans erreur ni fuite. Avec `ids` et une période, la fenêtre s'applique aussi (le lien des anomalies passe par « toutes les périodes », `anomalies-widget.tsx:107`).
7. **Actions en masse inchangées et sûres.** « Tout sélectionner (cette page) », pointer en lot et supprimer en lot agissent sur les lignes cochées visibles de la page affichée, y compris les dépenses réservées (le front ne envoie que les ids cochés présents dans la page : `transaction-list.tsx:216-217`, `:279-281`) ; la sélection est remise à zéro quand la période, la page ou un filtre change (`transaction-list.tsx:197-217`).
8. **Une période fermée et « toutes les périodes » se comportent comme avant** pour tout ce qui ne dépend pas de la règle de fenêtre : mêmes lignes, même ordre, même total.

## Règle critique (test écrit avant le code)
**La liste d'une période contient exactement les opérations pour lesquelles `isInPeriodWindow(t, période)` est vrai** (compte, période active ou fermée, avec ou sans fin), et son `meta.total` vaut leur nombre. Le test écrit avant le code compare la liste à `isInPeriodWindow` appliqué à un même jeu de transactions (une seule définition de la règle, pas une seconde écrite à la main dans le test), et vérifie `total == cardCount` pour « À pointer ».

Base de la table : période du 2026-11-01 au 2026-11-30, aujourd'hui 2026-11-24, une opération de −12 000 (centimes) sauf mention.

| # | Période | Opération | Dans la liste ? |
| --- | --- | --- | --- |
| 1 | active, fin 30/11 | dépense datée 05/12 (`pending`, catégorisée) | oui (nouveau) |
| 2 | active | CB non rapprochée non `pending`, 05/12 | oui (nouveau) ; comptée dans `n` |
| 3 | active | dépense rapprochée, 05/12 | oui (nouveau) |
| 4 | active | dépense sans catégorie, 05/12 | oui (nouveau) |
| 5 | active | dépense datée le 30/11 / le 15/11 | oui (déjà) |
| 6 | active | dépense datée le 31/10 | non |
| 7 | active | revenu +12 000 daté 05/12 | non |
| 8 | active | remboursement +12 000 sur catégorie de dépense, 05/12 | non |
| 9 | active, fin dépassée (aujourd'hui 05/12) | dépense datée 03/12 | oui |
| 10 | active, sans fin | toute opération datée ≥ début, revenus compris | oui |
| 11 | fermée, fin 30/11 | dépense datée 05/12 | non |
| 12 | fermée | dépense datée ≤ 30/11 | oui (déjà) |
| 13 | active + `endDate` explicite 30/11 | dépense datée 05/12 | non (la date saisie restreint la fenêtre) ; dépense 30/11 : oui |
| 14 | active + `startDate` explicite 10/11 | dépense datée 05/11 | non (restreint) ; dépense 15/11 : oui ; dépense 31/10 : non |
| 15 | active + recherche « loyer » | dépense 05/12 « Loyer » / dépense 05/12 « Cinéma » | oui / non |
| 16 | active + `ids` contenant une dépense du compte 05/12 et un id d'un autre compte | | la première seulement |
| 17 | aucune période (« toutes ») | dépense 05/12, revenu 05/12 | oui, oui |

## Recherche : deux `.or()` PostgREST (point technique à verrouiller par test)
La fenêtre d'une période active demande une condition « date ≤ fin OU montant < 0 », et la recherche en pose déjà une (`description` OU `notes`, `repository:61-63`). Exigence (le QUOI) : les deux se combinent par ET, aucune ne remplace ni n'élargit l'autre. Constat du code : `postgrest-js` ajoute chaque `.or()` en paramètre `or=` répété (`PostgrestFilterBuilder.ts:659-660`) ; PostgREST combine les paramètres répétés en ET, à vérifier sur une vraie base, pas sur le client simulé du dépôt (limite déjà notée pour `ids` dans `docs/transactions.md` « Zones d'ombre »). Test requis : requête réelle (`http/` à la racine) avec recherche + période active + dépense datée après la fin, dans les deux sens (qui correspond / qui ne correspond pas). Le développeur choisit la formulation ; elle ne doit pas casser la neutralisation des caractères spéciaux de la recherche (`search-filter.ts`).

## Ce que le code tranche déjà
- Tri : la liste paginée trie par date seule (`repository:91-92`), alors que la version non paginée ajoute `id` (`:169-170`) : à date égale, l'ordre n'est pas garanti d'une page à l'autre. Les dépenses réservées augmentent les ex æquo ; le critère 4 impose un départage (`id`), donc ce correctif est dans le cycle.
- `isActive` est lu sur la période chargée par le contrôleur (`periodRepository.findById`, `controller:442`) ; une période d'un autre compte donne déjà 404 (`ensureBelongsToAccount`). Aucun accès à un autre compte n'est ajouté : `account_id` est posé avant tout filtre (`repository:53,125`) et les filtres sont ET.
- Une seule période active par compte (`periods_one_active_per_account`, `docs/periods.md` l.104) et seule la dernière peut être réactivée (409 `PERIOD_NOT_LATEST`) : une dépense datée après la fin n'apparaît donc que dans la liste d'une seule période, dans le cas normal.
- Le front envoie `periodId` (jamais les dates de période) ; `startDate`/`endDate` ne viennent que du panneau de filtres (`transaction-list.tsx:119-127`). Aucune modification du front n'est nécessaire pour la liste, le total, la pagination, la sélection de page ou les comptes d'état ; vérifié en réel (critère 2).
- Pas d'export de transactions : aucune route ni composant dans `functions/src/transactions` ni `frontend/src/features/transactions` ; hors périmètre.

## Chemins d'exposition (liste d'Opérations)
| Chemin | Source | Statut |
| --- | --- | --- |
| Liste paginée (`GET /:accountId/transactions`) | `controller:436`, `repository:41` | Couvert (1 à 6) |
| Liste non paginée (`findAllByAccountUnpaginated`) | `repository:112` ; appelée par le reporting avec ses propres bornes | Hors périmètre : la fenêtre du reporting est déjà `isInPeriodWindow` (`load-period-forecast-input.ts:55`). Ne pas modifier sa sémantique |
| Liens de À traiter : « CB à pointer » `state=a_pointer` | `to-handle.tsx:67` | Couvert (2) |
| Lien de dépassement `categoryId` (période courante) | `to-handle.tsx:76` | Couvert (1, 5) : la répartition compte déjà la dépense réservée |
| Lien d'anomalies `ids` + toutes périodes | `anomalies-widget.tsx:107` | Couvert (6) |
| Lien de dépassements fermés `categoryId` + toutes périodes | `overruns-tab.tsx:51` | Couvert (8) |
| Soldes de tête, « À pointer · n » | stats du reporting | Inchangés (2) |
| Actions en masse (sélection de page, pointer, supprimer) | `transaction-list.tsx:221-309` | Couvert (7) |
| Détail d'un tag | `get-tag-details.use-case.ts:66` | Hors périmètre (`besoin.md`) |
| Modifier / supprimer par `:id` | `controller:473,532` | Inchangé (pas de fenêtre) |

## Mesure d'impact
- Indicateur : nombre de CB comptées dans « À pointer » de la période active et absentes de la liste ouverte par son lien. Cible : 0.
- Mesure : en recette, `GET /:accountId/transactions?periodId={active}&reconciled=false&pending=false` : `meta.total` égal à `cardCount` des stats de la même période ; scénario httpYac avec une CB de contrôle datée après la fin (créée puis supprimée).
- Au 2026-11-24 aucune dépense future n'existe en recette (`specs/factures-reservees/spec.md`) : l'indicateur ne bougera pas à la livraison ; la preuve est le test de la règle critique et la CB de contrôle.
- « Livré ✅ » seulement si vu en réel (application lancée en recette) ; le front se coche avec Playwright (`npm run e2e` sur la recette).

## Exploitation
- Retour arrière : `git revert` des commits du cycle (lecture seule, aucune donnée écrite, aucun schéma modifié).
- Pas de feature flag : aucune écriture. Pas de migration (le projet gère son schéma par `supabase/migrations/`, non touché).
- Surveillance : la liste d'une période active peut s'allonger de dépenses futures (comme son prévu).

## Parties sensibles
Aucune au sens du skill `point-de-controle` :
- **Argent** : aucun calcul de solde, de prévu ou de total d'argent ne change ; la liste est en lecture seule, `meta.total` est un nombre de lignes, pas un montant.
- **Algorithme** : la règle existe déjà (`period-window.ts`) ; on l'applique à une liste. Le seul risque est de l'écrire une deuxième fois sous forme de filtre ; il est couvert par la règle critique (test comparé à `isInPeriodWindow`).
- **Données d'un autre utilisateur** : n'est pas une partie sensible du skill (droit d'accès, traité en critère 6). Aucun nouveau chemin d'accès : `account_id` + RLS inchangés, `periodId` d'un autre compte = 404 déjà en place.
- **Actions en masse** : la liste contient plus de lignes, donc la suppression en lot peut atteindre des dépenses réservées ; le périmètre d'action reste la page affichée (critère 7), comme avant. Pas de concurrence ni de nouvelle brique.
Lucas peut quand même demander à voir le code avant commit s'il juge la suppression en lot trop exposée ; ce n'est pas exigé ici.

## Hypothèses
- Données héritées : si une période active n'est pas la plus récente (cas écarté à la création par l'API, mais possible en base ancienne), une dépense datée après sa fin figurerait aussi dans la liste de la période suivante. Même limite que le reporting.
- « Dépense » = montant < 0 quelle que soit la catégorie ; un virement sortant daté après la fin est une dépense (comme `factures-reservees`).
- Front inchangé : le libellé « toutes les périodes » et les textes ne bougent pas.

## Points ouverts (décisions de Lucas)
Aucune décision métier à remonter : le besoin est tranché (accord du 2026-11-24) et le reste se résout par le code.

## Hors périmètre
Détail d'un tag, export, rythme de dépense, changement des soldes, des libellés ou de la définition de `pending`/En banque/À venir ; ajout d'un filtre de période côté UI.
Défaut existant (dates du panneau de filtres ignorées en silence avec une période choisie) : corrigé après ce cycle, les dates restreignent la fenêtre.

## Fichiers concernés
Chemins vérifiés par Glob/Grep. Schéma non touché : pas de migration.

À modifier :
- `functions/src/transactions/infrastructure/transactions.controller.ts` (l.436-449) : garder le remplacement des dates par celles de la période ; transmettre en plus la fenêtre de la période (début, fin, active).
- `functions/src/transactions/domain/transaction.repository.interface.ts` : option de fenêtre dans `FindAllTransactionsOptions`.
- `functions/src/transactions/infrastructure/supabase-transaction.repository.ts` : fenêtre dans `findAllByAccount` (liste paginée) ; départage par `id` du tri ; `findAllByAccountUnpaginated` garde sa sémantique.
- `functions/src/transactions/application/get-transactions-by-account.use-case.ts` : transmission de l'option si nécessaire.
- Tests à compléter : `functions/src/transactions/infrastructure/supabase-transaction.repository.spec.ts` (fenêtre, recherche + fenêtre, `ids` + `account_id`), `functions/src/transactions/application/get-transactions-by-account.use-case.spec.ts`, `functions/test/transactions.e2e-spec.ts` (période active/fermée).
- Réutiliser sans modifier : `functions/src/reporting/domain/period-window.ts` (table de cas de la règle déjà dans `period-window.spec.ts`).

À créer (Glob : absents) :
- `http/operations-reservees.http` (racine) : scénario réel httpYac (période active, CB après la fin, `state=a_pointer` vs `cardCount`, recherche + fenêtre, `ids` d'un autre compte), voisin de `http/factures-reservees.http`.

Front : aucune modification prévue ; vérification Playwright en recette (lien « CB à pointer »).
Après le cycle : `docs/transactions.md` (règles l.38-39, 50, zone d'ombre `ids`) par le documentaliste.
