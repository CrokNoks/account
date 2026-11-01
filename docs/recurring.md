# Transactions récurrentes — modèles de dépenses/revenus qui reviennent chaque mois à un jour fixe

Mise à jour : 2026-11-01 · Commit : fc285ef

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Transaction récurrente | Un modèle (description, montant, catégorie, jour du mois). Ce n'est pas une vraie transaction : elle n'apparaît dans les comptes que si on l'injecte à la création d'une période. |
| Jour du mois | Entier de 1 à 31 ; pour un mois plus court, le dernier jour du mois est utilisé (règle unique `shared/domain/recurring-day.ts`, appliquée par `periods`, le calendrier et la trésorerie prévue ; une seule occurrence par mois). |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Le compte est obligatoire | `functions/src/recurring/domain/recurring-transaction.entity.ts:37-38` | ✅ `recurring-transaction.entity.spec.ts` (« requires an account ») |
| La description est obligatoire (pas vide ni que des espaces) | `recurring-transaction.entity.ts:39-41` | ❌ (le test « does not save an invalid recurring transaction » de `recurring-transactions.use-cases.spec.ts` couvre l'enregistrement refusé) |
| À l'entrée de l'API, la description est limitée à 255 caractères (comme la base) et refusée si blanche, création et modification : 400 « description must be shorter than or equal to 255 characters » / « Description is required » (message sous forme de tableau, comme toute erreur de validation) | `recurring.controller.ts:46-47,70-71` (DTO) | ✅ e2e `validation.e2e-spec.ts` |
| Le jour du mois est entre 1 et 31 | `recurring-transaction.entity.ts:42-44` ; DTO `recurring.controller.ts:54-56,80-82` ; base `supabase/migrations/20260309000000_create_recurring_transactions.sql:8` (CHECK) | ❌ |
| À la création et à la modification, la catégorie citée doit appartenir au compte de l'URL, sinon 400 « Category does not belong to this account » sans écriture (`AccountReferencesService`) | `create-recurring-transaction.use-case.ts:21-23`, `update-recurring-transaction.use-case.ts:27` | ✅ `recurring-transactions.use-cases.spec.ts`, e2e `cross-account-references.e2e-spec.ts` |
| La catégorie est facultative ; si la catégorie est supprimée, la récurrente reste avec catégorie vide | `20260309000000_create_recurring_transactions.sql:5` (ON DELETE SET NULL) | ❌ |
| Le montant est reçu en chaîne d'entier de centimes signé dans ±(2^53 − 1) (`@IsCents` / `parseCents`, `shared/`), décimal ou hors bornes → 400, « -0 » lu comme 0 ; signe libre, plus aucun arrondi | `recurring.controller.ts:50,75,130,150`, `shared/domain/cents.ts`, `shared/infrastructure/is-cents.decorator.ts` | ✅ `cents.spec.ts`, e2e `validation.e2e-spec.ts` ; vérifié en réel `http/montants-centimes-entiers.http` |
| Modification partielle : seuls les champs envoyés changent (le contrôleur ne transmet que les champs fournis) et l'entité est revalidée ; sans `amount`, le montant existant est conservé | `recurring.controller.ts:135-159`, `update-recurring-transaction.use-case.ts:29-37` | ✅ e2e `validation.e2e-spec.ts` |
| Le corps de la modification est validé par `UpdateRecurringTransactionDto` (champs facultatifs : catégorie, description, montant en chaîne d'entier de centimes (`@IsCents`), jour 1-31) ; tout autre champ, dont `accountId`, est refusé en 400 : une récurrente ne change jamais de compte | `recurring.controller.ts:61-85` | ✅ e2e `validation.e2e-spec.ts` |
| Modifier une récurrente inexistante renvoie 404 (`NotFoundError`) | `update-recurring-transaction.use-case.ts:19-23` (`ensureBelongsToAccount`, aussi pour une récurrente d'un autre compte) | ✅ `recurring-transactions.use-cases.spec.ts` (« rejects an unknown recurring transaction », « …of another account… ») |
| Injection dans une période (jour calculé, transactions « en attente ») | `functions/src/periods/application/create-period-with-budgets.use-case.ts:54-89` | ✅ partielle (voir `docs/periods.md`) |
| Elles servent aussi à calculer le montant par défaut d'une catégorie dans le brouillon de période | `functions/src/periods/application/get-period-draft.use-case.ts:59-75` | ✅ (spec des périodes) |
| Supprimer un compte supprime ses récurrentes ; accès en base selon l'accès au compte | `20260309000000_create_recurring_transactions.sql:4,17-31` | ❌ |
| Tests du module : création, refus d'une catégorie d'un autre compte, enregistrement invalide refusé, liste, suppression, fusion des champs, récurrente inconnue ou d'un autre compte, validation du résultat fusionné. Non couverts : jour du mois hors 1-31 (entité), description blanche (entité) | `functions/src/recurring/application/recurring-transactions.use-cases.spec.ts`, `domain/recurring-transaction.entity.spec.ts` | ✅ partielle |
| `null` refusé en 400 sur `description`, `amount` et `dayOfMonth` en modification (absent = inchangé) ; `categoryId: null` retire la catégorie | `recurring.controller.ts` (`@IsOptionalNotNull()`) | ✅ `functions/test/validation.e2e-spec.ts` (« null on a field that cannot be null »), `http/null-refuse.http` |

## Ce qu'on stocke
Table `recurring_transactions` : id ; compte ; catégorie (peut être vide) ; description (255 caractères max en base) ; montant (BIGINT, centimes) ; jour du mois (1-31) ; dates de création/modification (trigger `set_recurring_transactions_updated_at`, lignes 33-37).

## Ce qu'on peut faire
Qui : toutes les routes exigent un token de connexion valide (`@UseGuards(SupabaseAuthGuard)`, `recurring.controller.ts:100`). Pas de middleware ni de décorateur d'identité : l'utilisateur n'est pas lu par le contrôleur. Les droits sont contrôlés uniquement en base (RLS), le client Supabase portant le token de l'utilisateur (`functions/src/supabase/supabase.module.ts:25-40`). En modification/suppression, la récurrence doit appartenir à `:accountId` (`account-ownership.ts`) : inexistante ou d'un autre compte = 404 identique, sans écriture.

| Action | Point d'entrée | Effet | Source |
| --- | --- | --- | --- |
| Lister | `GET /:accountId/recurring` | toutes celles du compte, sans tri défini | `recurring.controller.ts:110` |
| Créer | `POST /:accountId/recurring` | crée et renvoie | `recurring.controller.ts:120` |
| Modifier | `PATCH /:accountId/recurring/:id` | modification partielle | `recurring.controller.ts:135` |
| Supprimer | `DELETE /:accountId/recurring/:id` | supprime ; annoncé 204 par la doc Swagger, mais aucun `@HttpCode` : le code réellement renvoyé est celui par défaut de Nest (non testé) | `recurring.controller.ts:161` |

Front (`frontend/src/features/recurring/`) : liste avec modification en panneau et suppression après confirmation navigateur (`ui/recurring-transaction-list.tsx`), dialogue de création (`ui/create-recurring-dialog.tsx`, montant converti par `toCents` ; un montant illisible est refusé avec un message d'erreur, y compris à la modification). Hooks `useRecurringTransactions`, `useCreateRecurringTransaction`, `useUpdateRecurringTransaction`, `useDeleteRecurringTransaction` (clé `['recurring-transactions', accountId]`, notifications de succès ; en cas d'échec, la notification affiche le message renvoyé par l'API, à défaut un message traduit).

## Statuts et transitions
Pas de cycle de vie.

## Zones d'ombre
- Les identifiants reçus en body (`categoryId`) doivent être des UUID : sinon 400 (voir `transactions.md`). Ceux de la route (`:accountId`, `:id`) le sont aussi (voir `transactions.md`).
- Une récurrente n'a ni date de début/fin ni état actif : le code ne permet pas de la suspendre.
- Rien ne les injecte automatiquement chaque mois : seule la création d'une période avec `injectRecurring` le fait.
- Le signe attendu du montant (dépense négative ?) n'est pas imposé.
- Erreur « not found » = `NotFoundError`, traduite en 404 par le filtre global.
