# Transactions récurrentes — modèles de dépenses/revenus qui reviennent chaque mois à un jour fixe

Mise à jour : 2026-10-30 · Commit : 157b272

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Transaction récurrente | Un modèle (description, montant, catégorie, jour du mois). Ce n'est pas une vraie transaction : elle n'apparaît dans les comptes que si on l'injecte à la création d'une période. |
| Jour du mois | Entier de 1 à 31 ; pour un mois plus court, le dernier jour du mois est utilisé (règle appliquée par `periods`). |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Le compte est obligatoire | `functions/src/recurring/domain/recurring-transaction.entity.ts:35` | ❌ |
| La description est obligatoire (pas vide ni que des espaces) | `recurring-transaction.entity.ts:36-38` | ❌ |
| Le jour du mois est entre 1 et 31 | `recurring-transaction.entity.ts:39` ; DTO `recurring.controller.ts:47-49` ; base `supabase/migrations/20260309000000_create_recurring_transactions.sql:8` (CHECK) | ❌ |
| La catégorie est facultative ; si la catégorie est supprimée, la récurrente reste avec catégorie vide | `20260309000000_create_recurring_transactions.sql:5` (ON DELETE SET NULL) | ❌ |
| Le montant est reçu en texte, arrondi puis converti en entier (centimes) ; signe libre | `recurring.controller.ts:97,111` | ❌ |
| Modification partielle : seuls les champs envoyés changent, et l'entité est revalidée | `update-recurring-transaction.use-case.ts:18-22` | ❌ |
| Modifier une récurrente inexistante lève une erreur générique | `update-recurring-transaction.use-case.ts:16` | ❌ |
| Injection dans une période (jour calculé, transactions « en attente ») | `functions/src/periods/application/create-period-with-budgets.use-case.ts:62-98` | ❌ (voir `docs/periods.md`) |
| Elles servent aussi à calculer le montant par défaut d'une catégorie dans le brouillon de période | `functions/src/periods/application/get-period-draft.use-case.ts:64-70` | ✅ (spec des périodes) |
| Supprimer un compte supprime ses récurrentes ; accès en base selon l'accès au compte | `20260309000000_create_recurring_transactions.sql:4,17-31` | ❌ |
| Aucun test dans ce module | (aucun `*.spec.ts` dans `functions/src/recurring/`) | ❌ |

## Ce qu'on stocke
Table `recurring_transactions` : id ; compte ; catégorie (peut être vide) ; description (255 caractères max en base) ; montant (BIGINT, centimes) ; jour du mois (1-31) ; dates de création/modification (trigger `updated_at`, ligne 34).

## Ce qu'on peut faire
Qui : toutes les routes exigent un token de connexion valide (`@UseGuards(SupabaseAuthGuard)`, `recurring.controller.ts:67`). Pas de middleware ni de décorateur d'identité : l'utilisateur n'est pas lu par le contrôleur. Les droits sont contrôlés uniquement en base (RLS), le client Supabase portant le token de l'utilisateur (`functions/src/supabase/supabase.module.ts:25-38`). `:accountId` n'est pas rapproché de `:id` en modification/suppression.

| Action | Point d'entrée | Effet | Source |
| --- | --- | --- | --- |
| Lister | `GET /:accountId/recurring` | toutes celles du compte, sans tri défini | `recurring.controller.ts:77` |
| Créer | `POST /:accountId/recurring` | crée et renvoie | `recurring.controller.ts:87` |
| Modifier | `PATCH /:accountId/recurring/:id` | modification partielle | `recurring.controller.ts:102` |
| Supprimer | `DELETE /:accountId/recurring/:id` | supprime | `recurring.controller.ts:116` |

Front (`frontend/src/features/recurring/`) : liste avec modification en panneau et suppression après confirmation navigateur (`ui/recurring-transaction-list.tsx`), dialogue de création (`ui/create-recurring-dialog.tsx`, montant converti par `toCents`). Hooks `useRecurringTransactions`, `useCreateRecurringTransaction`, `useUpdateRecurringTransaction`, `useDeleteRecurringTransaction` (clé `['recurring-transactions', accountId]`, messages de succès/échec par notification).

## Statuts et transitions
Pas de cycle de vie.

## Zones d'ombre
- Les DTO de modification (`Partial<CreateRecurringTransactionDto>`) sont typés mais le contrôleur n'applique pas de validation propre à la modification que le code montre ; la validation de l'entité reste le garde-fou.
- Une récurrente n'a ni date de début/fin ni état actif : le code ne permet pas de la suspendre.
- Rien ne les injecte automatiquement chaque mois : seule la création d'une période avec `injectRecurring` le fait.
- Le signe attendu du montant (dépense négative ?) n'est pas imposé.
- Erreur « not found » = erreur générique, pas 404.
