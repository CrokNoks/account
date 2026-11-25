# Transactions récurrentes — modèles de dépenses/revenus qui reviennent chaque mois à un jour fixe

Mise à jour : 2026-11-25 · Commit : 90f9a7e (declencheur-periode : occurrences sur une période à cheval, injection par la bascule, prochaine paie) ; avant : fc285ef

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Transaction récurrente | Un modèle (description, montant, catégorie, jour du mois). Ce n'est pas une vraie transaction : elle n'apparaît dans les comptes que si on l'injecte, à la création d'une période ou à la bascule déclenchée par la catégorie déclencheuse (voir `docs/periods.md`). |
| Jour du mois | Entier de 1 à 31 ; pour un mois plus court, le dernier jour du mois est utilisé (règle unique `shared/domain/recurring-day.ts`, appliquée par `periods`, le calendrier et la trésorerie prévue ; une seule occurrence par mois civil touché par la période : une période à cheval sur deux mois en reçoit une dans chacun, une période de plus d'un mois en reçoit plusieurs ; `recurringOccurrences`, même fichier). |

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
| Injection dans une période (jour calculé à chaque mois civil touché, transactions « en attente ») : à la création manuelle (toutes les occurrences, sans contrôle de doublon) et à la bascule du déclencheur (une occurrence par mois civil et par récurrente, sauf si une transaction de la même récurrente `metadata.recurringId` existe déjà ce mois-ci, y compris dans l'ancienne période, et sauf une paie à moins de 15 jours du début) | `functions/src/periods/application/create-period-with-budgets.use-case.ts:64-92`, `functions/src/shared/domain/recurring-day.ts:26-45`, `functions/src/periods/domain/period-switch.ts:356-393` | ✅ `recurring-day.spec.ts`, `create-period-with-budgets.use-case.spec.ts`, `period-switch.spec.ts` (voir `docs/periods.md`) |
| **Paie récurrente** : une récurrente de la catégorie déclencheuse du compte et de montant strictement positif sert à fixer la fin de la nouvelle période (la veille de sa prochaine occurrence, à au moins 15 jours du début ; la plus proche s'il y en a plusieurs) ; cette prochaine occurrence est créée en `pending` le lendemain de la fin, une seule fois. Une récurrente négative de cette catégorie ne fait pas cela (traitée comme les autres). Le lien entre une transaction et sa récurrente est `metadata.recurringId` (posé à l'injection) : modifiable ensuite par la personne via `metadata`, donc fragile | `period-switch.ts:299-300,342-354,395-414` | ✅ `period-switch.spec.ts` (aucune paie, plusieurs, négative, 14 / 15 jours, prochaine paie une seule fois) |
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
| Supprimer | `DELETE /:accountId/recurring/:id` | supprime ; répond 204 sans corps (`@HttpCode(204)`, comme toutes les suppressions) | `recurring.controller.ts:162` ; ✅ e2e `account-ownership.e2e-spec.ts`, `http/suppressions-204.http` |

Front (`frontend/src/features/recurring/`) : liste avec modification en panneau et suppression après confirmation navigateur (`ui/recurring-transaction-list.tsx`), dialogue de création (`ui/create-recurring-dialog.tsx`, montant converti par `toCents` ; un montant illisible est refusé avec un message d'erreur, y compris à la modification). Hooks `useRecurringTransactions`, `useCreateRecurringTransaction`, `useUpdateRecurringTransaction`, `useDeleteRecurringTransaction` (clé `['recurring-transactions', accountId]`, notifications de succès ; en cas d'échec, la notification affiche le message renvoyé par l'API, à défaut un message traduit).

## Statuts et transitions
Pas de cycle de vie.

## Zones d'ombre
- Les identifiants reçus en body (`categoryId`) doivent être des UUID : sinon 400 (voir `transactions.md`). Ceux de la route (`:accountId`, `:id`) le sont aussi (voir `transactions.md`).
- Une récurrente n'a ni date de début/fin ni état actif : le code ne permet pas de la suspendre.
- Rien ne les injecte automatiquement chaque mois (aucune tâche planifiée) : seules la création d'une période avec `injectRecurring` et la bascule du déclencheur le font, quand une transaction de la catégorie déclencheuse est enregistrée (voir `docs/periods.md`). Une récurrente ajoutée ou modifiée n'est pas injectée dans la période en cours.
- Le signe attendu du montant (dépense négative ?) n'est pas imposé.
- Erreur « not found » = `NotFoundError`, traduite en 404 par le filtre global.
