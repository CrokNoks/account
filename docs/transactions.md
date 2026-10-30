# Transactions — saisir, retrouver, corriger, importer et déplacer l'argent d'un compte

Mise à jour : 2026-10-30 · Commit : 157b272

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Transaction | Une ligne d'argent sur un compte. Montant en centimes entiers : négatif = dépense, positif = revenu (le formulaire front indique la convention, `expense_hint`) |
| Rapprochée (`reconciled`) | Ligne pointée comme vérifiée contre le relevé bancaire |
| En attente (`pending`) | Ligne pré-autorisée, à ne pas compter dans le solde « validé » (commentaire SQL `20260309100000`) |
| Virement | Deux transactions liées (sortie sur le compte source, entrée sur la destination) partageant un `transferId` |
| Période | Découpage du temps d'un compte (module `periods`, hors périmètre) |
| Règle intelligente | Règle qui propose catégorie/tags d'après la description (module `smart-rules`, hors périmètre) |
| Objectif d'épargne | Cible d'épargne (module `savings-goals`) à laquelle une transaction peut être rattachée |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Une transaction exige un compte, une description non vide et un montant | `functions/src/transactions/domain/transaction.entity.ts:42-50` | ✅ `transaction.entity.spec.ts` (description vide, compte manquant) |
| `reconciled` et `pending` valent faux par défaut | `transaction.entity.ts:96-97` | ✅ `transaction.entity.spec.ts` |
| Création : une transaction est enregistrée telle quelle (aucune règle intelligente appliquée) | `application/create-transaction.use-case.ts` | ✅ `create-transaction.use-case.spec.ts` |
| Import en lot : si aucune catégorie n'est donnée, les règles intelligentes du compte sont appliquées et leurs tags s'ajoutent à ceux fournis | `application/bulk-create-transactions.use-case.ts:27-39` | ❌ |
| Import en lot : traité ligne par ligne, sans transaction globale (un échec laisse les lignes déjà créées) | `bulk-create-transactions.use-case.ts:25-52` | ❌ |
| Virement : montant strictement positif ; comptes source et destination différents | `application/create-transfer.use-case.ts:20-25` | ❌ |
| Virement : le compte de destination doit être visible de l'appelant (introuvable ou invisible par la RLS → 404) et en écriture : propriétaire, ou partage `write` (partage `read` ou aucun → 403) ; rien n'est écrit en cas de refus. La permission se lit dans la ligne de partage de l'appelant (visible de lui par la RLS `user_id = auth.uid()`) | `create-transfer.use-case.ts` (`ensureCanWriteTo`) | ✅ `create-transfer.use-case.spec.ts`, e2e `cross-account-references.e2e-spec.ts` |
| Catégorie, tags et objectif d'épargne envoyés (création simple, modification simple, import en lot, modification en lot) doivent appartenir au compte de l'URL, sinon 400 (« Category/Tag/Savings goal does not belong to this account ») sans aucune écriture ; l'import en lot est vérifié en entier avant la première écriture. Une catégorie globale (sans compte) ou inconnue est refusée : aucune n'est exposée par la RLS ni utilisée par le front. Règle unique dans `AccountReferencesService` | `shared/application/account-references.service.ts` | ✅ specs des cas d'usage, e2e `cross-account-references.e2e-spec.ts` |
| Virement : sortie = montant négatif, entrée = montant positif, sans catégorie, metadata `transferId`, `type` (`transfer_out`/`transfer_in`), `relatedAccountId` ; les deux lignes sont enregistrées l'une après l'autre (pas atomique) | `create-transfer.use-case.ts:27-58` | ❌ |
| Modification (simple et en lot) : si `reconciled` est envoyé à vrai, `pending` est remis à faux, même si `pending: true` est envoyé en même temps ; règle unique `resolvePending` | `domain/pending-rule.ts` ; `infrastructure/transactions.controller.ts` ; `bulk-update-transactions.use-case.ts` | ✅ `pending-rule.spec.ts`, `bulk-update-transactions.use-case.spec.ts`, e2e `transactions.e2e-spec.ts` |
| Modification : seuls les champs fournis changent (tags, objectif d'épargne, date, montant conservés sinon) ; montant arrondi à l'entier | `transactions.controller.ts:440-459` | ✅ e2e `transactions.e2e-spec.ts` |
| Création et modification : le corps est validé (`CreateTransactionBodyDto` / `UpdateTransactionDto`, sans `accountId`) : date ISO, montant en texte numérique, description texte ; champ inconnu, `accountId`, date ou montant invalide → 400 et rien n'est enregistré ; une description vide ou blanche reste refusée par l'entité (400) | `transactions.controller.ts:120-126,377,482` | ✅ e2e `transactions.e2e-spec.ts`, `validation.e2e-spec.ts` |
| Modification/suppression en lot : seules les transactions réellement dans le compte de l'URL sont touchées, les autres identifiants sont ignorés silencieusement | `bulk-update-transactions.use-case.ts:24-30`, `bulk-delete-transactions.use-case.ts:15-22` | ❌ |
| Modification en lot : seuls catégorie, tags, rapprochée, en attente sont modifiables ; `reconciled=true` remet `pending` à faux (même règle que la modification simple) | `bulk-update-transactions.use-case.ts` | ✅ `bulk-update-transactions.use-case.spec.ts` |
| Prédiction de catégorie : description de moins de 3 caractères → aucune ; sinon règles intelligentes d'abord, puis classifieur statistique (Bayes) entraîné sur les transactions déjà catégorisées du compte | `application/predict-category.use-case.ts:21-62` | ❌ |
| Liste : tri par date décroissante ; pagination page 1, 1000 par page par défaut | `infrastructure/supabase-transaction.repository.ts:81-88` | ✅ partielle : `get-transactions-by-account.use-case.spec.ts` (options transmises, repo simulé) |
| Liste : filtres date de début/fin (inclusifs, au jour), texte (description OU notes, insensible à la casse), catégorie, tags (au moins un des tags), montant min/max, rapprochée | `supabase-transaction.repository.ts:54-79` | ❌ |
| Liste avec `periodId` : les dates de la période remplacent `startDate`/`endDate` ; période inconnue → 404 | `transactions.controller.ts:369-374` | ❌ |
| Enregistrer une transaction remplace entièrement ses tags (suppression puis réinsertion) | `supabase-transaction.repository.ts:225-244` | ❌ |
| Solde cumulé avant une date : somme des montants des transactions strictement antérieures (appel SQL) ; en cas d'erreur renvoie 0 | `supabase-transaction.repository.ts:157-176`, `supabase/migrations/20260308100000_add_sum_transactions_func.sql` | ❌ |
| En base : à l'insertion, si aucune période n'est donnée, la période active du compte est affectée | `supabase/migrations/20251229111000_add_period_id_to_expenses.sql:9-37` (trigger renommé `set_transactions_period_id`, `20260307000000_migrate_to_v2.sql`) | ❌ |
| En base : lire = accès `read` au compte, créer/modifier/supprimer = accès `write` (propriétaire, ou partagé en `write`) | `supabase/migrations/20260307000000_migrate_to_v2.sql:72-86` | ❌ |
| En base : rattacher une transaction à un objectif d'épargne met à jour son montant courant : ajout = objectif − montant (une dépense de 50 € augmente l'objectif de 50 €), suppression ou changement d'objectif = annulation | `supabase/migrations/20260318143724_sync_savings_goals_trigger.sql` (trigger `trg_sync_savings_goal_on_transaction`) | ❌ |
| En base : suppression d'un objectif d'épargne → `savings_goal_id` de la transaction mis à vide | `20260318131922_link_transactions_to_savings.sql` | ❌ |
| Front : le montant saisi est converti en centimes entiers par `parseAmountToCents` (sans flottant) : espaces (dont insécables), symboles et lettres ignorés ; `-` en tête ou en fin = négatif ; si `.` et `,` sont tous deux présents le dernier est le séparateur décimal ; un séparateur répété (`1.234.567`) = milliers ; un séparateur unique (`10,50`, `10.50`) = décimal ; au-delà de 2 décimales arrondi au centime supérieur (`1.005` → 101) ; saisie invalide → `0`. Pour un virement la valeur absolue est envoyée. L'import CSV (montant unique ou débit/crédit, `crédit − |débit|`) utilise la même fonction | `frontend/src/shared/lib/format.ts`, `import/page.tsx` (`processMapping`), `features/transactions/ui/create-transaction-drawer.tsx:114,130` | ✅ `format.test.ts`, `import/page.test.tsx` |
| Front : la catégorie est suggérée après saisie de la description (délai anti-rafale) | `features/transactions/ui/transaction-form.tsx:69-90` | ❌ |

## Ce qu'on stocke
Transaction (`transactions`) : id, compte, catégorie (optionnelle), période (optionnelle), date (jour), description, montant (centimes, BIGINT), rapprochée, en attente, moyen de paiement, notes, metadata (JSON libre, contient `transferId` pour les virements), objectif d'épargne (optionnel), dates de création/modification. Table de liaison `transaction_tags` (transaction, tag) ; supprimée avec la transaction. L'API renvoie les montants en texte.

## Ce qu'on peut faire
Toutes les routes sont préfixées par l'identifiant du compte : `/:accountId/transactions`. Qui : connecté (token exigé, `@UseGuards(SupabaseAuthGuard)`, `transactions.controller.ts:308`), pas de middleware ni de décorateur d'identité ; l'identité n'est pas lue. Le contrôle propriétaire/partage n'est fait que par la base (RLS) via le token transmis ; le code ne vérifie pas que l'utilisateur a accès à `:accountId`. En revanche, la modification/suppression par `:id` et le filtre `periodId` exigent que la transaction / la période appartienne à `:accountId` : sinon 404 identique à « inexistant », sans écriture (`functions/src/shared/domain/account-ownership.ts`).

| Action | Point d'entrée | Qui | Effet | Source |
| --- | --- | --- | --- | --- |
| Lister (filtres, pages) | `GET /:accountId/transactions` | connecté + RLS | `{data, meta}` | `transactions.controller.ts:356` |
| Prédire la catégorie | `GET /:accountId/transactions/predict-category?description=` | connecté | `categoryId` (+ `tagIds` si règle) | `:344` |
| Créer | `POST /:accountId/transactions` | connecté + RLS (`write`) | transaction créée | `:504` |
| Créer en lot (import) | `POST /:accountId/transactions/bulk` | idem | transactions créées | `:469` |
| Virement | `POST /:accountId/transactions/transfer` | idem (`write` sur le compte source ; destination : voir règles, 404/403 sans écriture) | 2 transactions | `:487` |
| Modifier | `PATCH /:accountId/transactions/:id` | idem ; le compte de l'URL n'est pas comparé à celui de la transaction | transaction mise à jour | `:426` |
| Supprimer | `DELETE /:accountId/transactions/:id` (204) | idem ; idem | supprimée | `:462` |
| Modifier en lot | `PATCH /:accountId/transactions/bulk` | idem, compte contrôlé | voir règles | `:399` |
| Supprimer en lot | `DELETE /:accountId/transactions/bulk` (corps `ids`) | idem, compte contrôlé | voir règles | `:413` |

Front (`frontend/src/features/transactions/`) : `transaction-list` (liste, filtres, sélection, création de récurrente), `transaction-table` / `transaction-mobile-list`, `transaction-filters`, `create-transaction-drawer` + `transaction-form` (mode standard ou virement), `bulk-actions-bar`, import en 3 étapes (`import/import-upload-step`, `import-mapping-step` : montant unique ou colonnes débit/crédit, `import-validation-step`). Hooks : `use-transactions`, `use-create-transaction`, `use-update-transaction`, `use-delete-transaction`, `use-create-transfer`, `use-bulk-transactions`, `use-bulk-create-transactions`, `use-predict-category`.

## Statuts et transitions
`pending` (en attente) et `reconciled` (rapprochée) sont deux booléens indépendants. Marquer rapprochée une transaction via la modification simple la sort de l'attente ; la modification en lot applique la même règle (`domain/pending-rule.ts`). Aucune transition n'est interdite par le code.

## Zones d'ombre
- Ordre des routes : `PATCH bulk` (399) et `DELETE bulk` (413) doivent rester déclarées avant `PATCH :id` (426) et `DELETE :id` (462), sinon Express les capte comme un `:id` (id = « bulk ») et la modification/suppression en lot devient inutilisable. Verrouillé par les tests e2e (`bulk routes`). Les champs de `data` en modification en lot sont validés (`BulkUpdateTransactionsDataDto`). Codes de retour : `DELETE :id` 204, `DELETE bulk` et `PATCH bulk` 200.
- Limite : la période (`periodId`) envoyée à la création d'une transaction n'est pas encore comparée au compte de l'URL.
- Les listes `GET /:accountId/...` ne vérifient pas l'accès au compte : pour un compte inaccessible, la RLS renvoie simplement une liste vide (comportement conservé).
- Dans le virement, le montant est lu avec `Math.round(Number(...))` : le comportement pour de très grands montants (précision) n'est pas défini.
- Le virement ne porte pas de catégorie et sa catégorie « transfer » (type de catégorie, `20260307000000`) n'est pas utilisée ici : le code ne dit pas le lien voulu.
- Le trigger d'objectif d'épargne s'applique aussi aux modifications de montant ; son comportement quand le montant et l'objectif changent ensemble n'est pas testé.
- Le « solde » d'un compte n'est calculé dans aucun fichier de ce module (seule la somme avant une date existe) ; `pending` est décrit comme « non compté » en SQL mais aucune règle de ce module ne l'exclut d'un calcul.
- Les filtres texte insèrent la saisie telle quelle dans le filtre PostgREST (`search`) : comportement avec virgules/caractères spéciaux non défini.
- « Transaction not found » est une `NotFoundError` (404) ; transfert vers le même compte ou montant non positif → 400 (`DomainValidationError`).
