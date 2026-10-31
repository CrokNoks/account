# Transactions récurrentes — modèles de dépenses/revenus qui reviennent chaque mois à un jour fixe

Mise à jour : 2026-10-30 · Commit : 157b272

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Transaction récurrente | Un modèle (description, montant, catégorie, jour du mois). Ce n'est pas une vraie transaction : elle n'apparaît dans les comptes que si on l'injecte à la création d'une période. |
| Jour du mois | Entier de 1 à 31 ; pour un mois plus court, le dernier jour du mois est utilisé (règle unique `shared/domain/recurring-day.ts`, appliquée par `periods`, le calendrier et la trésorerie prévue ; une seule occurrence par mois). |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Le compte est obligatoire | `functions/src/recurring/domain/recurring-transaction.entity.ts:35` | ❌ |
| La description est obligatoire (pas vide ni que des espaces) | `recurring-transaction.entity.ts:36-38` | ❌ |
| À l'entrée de l'API, la description est limitée à 255 caractères (comme la base) et refusée si blanche, création et modification : 400 « description must be shorter than or equal to 255 characters » / « Description is required » (message sous forme de tableau, comme toute erreur de validation) | `recurring.controller.ts` (DTO) | ✅ e2e `validation.e2e-spec.ts` |
| Le jour du mois est entre 1 et 31 | `recurring-transaction.entity.ts:39` ; DTO `recurring.controller.ts:47-49` ; base `supabase/migrations/20260309000000_create_recurring_transactions.sql:8` (CHECK) | ❌ |
| À la création et à la modification, la catégorie citée doit appartenir au compte de l'URL, sinon 400 « Category does not belong to this account » sans écriture (`AccountReferencesService`) | `create-/update-recurring-transaction.use-case.ts` | ✅ `recurring-transactions.use-cases.spec.ts`, e2e `cross-account-references.e2e-spec.ts` |
| La catégorie est facultative ; si la catégorie est supprimée, la récurrente reste avec catégorie vide | `20260309000000_create_recurring_transactions.sql:5` (ON DELETE SET NULL) | ❌ |
| Le montant est reçu en chaîne d'entier de centimes signé dans ±(2^53 − 1) (`@IsCents` / `parseCents`, `shared/`), décimal ou hors bornes → 400, « -0 » lu comme 0 ; signe libre, plus aucun arrondi | `recurring.controller.ts:113,136`, `shared/domain/cents.ts`, `shared/infrastructure/is-cents.decorator.ts` | ✅ `cents.spec.ts`, e2e `validation.e2e-spec.ts` ; vérifié en réel `http/montants-centimes-entiers.http` |
| Modification partielle : seuls les champs envoyés changent (le contrôleur ne transmet que les champs fournis) et l'entité est revalidée ; sans `amount`, le montant existant est conservé | `recurring.controller.ts:126-145`, `update-recurring-transaction.use-case.ts:18-22` | ✅ e2e `validation.e2e-spec.ts` |
| Le corps de la modification est validé par `UpdateRecurringTransactionDto` (champs facultatifs : catégorie, description, montant en chaîne d'entier de centimes (`@IsCents`), jour 1-31) ; tout autre champ, dont `accountId`, est refusé en 400 : une récurrente ne change jamais de compte | `recurring.controller.ts:54-76` | ✅ e2e `validation.e2e-spec.ts` |
| Modifier une récurrente inexistante renvoie 404 (`NotFoundError`) | `update-recurring-transaction.use-case.ts:16` | ❌ |
| Injection dans une période (jour calculé, transactions « en attente ») | `functions/src/periods/application/create-period-with-budgets.use-case.ts:62-98` | ❌ (voir `docs/periods.md`) |
| Elles servent aussi à calculer le montant par défaut d'une catégorie dans le brouillon de période | `functions/src/periods/application/get-period-draft.use-case.ts:64-70` | ✅ (spec des périodes) |
| Supprimer un compte supprime ses récurrentes ; accès en base selon l'accès au compte | `20260309000000_create_recurring_transactions.sql:4,17-31` | ❌ |
| Aucun test dans ce module | (aucun `*.spec.ts` dans `functions/src/recurring/`) | ❌ |

## Ce qu'on stocke
Table `recurring_transactions` : id ; compte ; catégorie (peut être vide) ; description (255 caractères max en base) ; montant (BIGINT, centimes) ; jour du mois (1-31) ; dates de création/modification (trigger `updated_at`, ligne 34).

## Ce qu'on peut faire
Qui : toutes les routes exigent un token de connexion valide (`@UseGuards(SupabaseAuthGuard)`, `recurring.controller.ts:91`). Pas de middleware ni de décorateur d'identité : l'utilisateur n'est pas lu par le contrôleur. Les droits sont contrôlés uniquement en base (RLS), le client Supabase portant le token de l'utilisateur (`functions/src/supabase/supabase.module.ts:25-38`). En modification/suppression, la récurrence doit appartenir à `:accountId` (`account-ownership.ts`) : inexistante ou d'un autre compte = 404 identique, sans écriture.

| Action | Point d'entrée | Effet | Source |
| --- | --- | --- | --- |
| Lister | `GET /:accountId/recurring` | toutes celles du compte, sans tri défini | `recurring.controller.ts:101` |
| Créer | `POST /:accountId/recurring` | crée et renvoie | `recurring.controller.ts:111` |
| Modifier | `PATCH /:accountId/recurring/:id` | modification partielle | `recurring.controller.ts:126` |
| Supprimer | `DELETE /:accountId/recurring/:id` | supprime | `recurring.controller.ts:147` |

Front (`frontend/src/features/recurring/`) : liste avec modification en panneau et suppression après confirmation navigateur (`ui/recurring-transaction-list.tsx`), dialogue de création (`ui/create-recurring-dialog.tsx`, montant converti par `toCents` ; un montant illisible est refusé avec un message d'erreur, y compris à la modification). Hooks `useRecurringTransactions`, `useCreateRecurringTransaction`, `useUpdateRecurringTransaction`, `useDeleteRecurringTransaction` (clé `['recurring-transactions', accountId]`, notifications de succès ; en cas d'échec, la notification affiche le message renvoyé par l'API, à défaut un message traduit).

## Statuts et transitions
Pas de cycle de vie.

## Zones d'ombre
- Les identifiants reçus en body (`categoryId`) doivent être des UUID : sinon 400 (voir `transactions.md`). Ceux de la route (`:accountId`, `:id`) le sont aussi (voir `transactions.md`).
- Une récurrente n'a ni date de début/fin ni état actif : le code ne permet pas de la suspendre.
- Rien ne les injecte automatiquement chaque mois : seule la création d'une période avec `injectRecurring` le fait.
- Le signe attendu du montant (dépense négative ?) n'est pas imposé.
- Erreur « not found » = `NotFoundError`, traduite en 404 par le filtre global.
