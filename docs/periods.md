# Périodes — découper la vie d'un compte en périodes (souvent un mois), avec un budget par catégorie et des transactions récurrentes injectées

Mise à jour : 2026-10-30 · Commit : 157b272

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Période | Intervalle de dates d'un compte (début, fin). Sert à regrouper les transactions et les budgets. |
| Période active | La période en cours : une seule à la fois par compte (voir règles). |
| Budget de période | Montant alloué à une catégorie pour la période (module `budgets`, voir `docs/budgets.md`). |
| Brouillon (draft) | Proposition calculée pour préparer la prochaine période : dates suggérées + statistiques et montant par défaut par catégorie. |
| Transaction récurrente | Modèle de transaction mensuelle (voir `docs/recurring.md`) ; peut être transformé en vraies transactions à la création d'une période. |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Une période a un compte ; la fin ne peut pas précéder le début (même jour accepté, fin vide acceptée) | `functions/src/periods/domain/period.entity.ts:34-36` | ✅ `period.entity.spec.ts` (4 cas) |
| Une période créée est active par défaut | `period.entity.ts:65` | ❌ |
| Créer une période désactive d'abord toutes les périodes actives du compte | `create-period-with-budgets.use-case.ts:34-42` | ❌ (le test ne couvre que la création simple) |
| Création : enregistre la période, puis les budgets (si au moins un), puis les transactions récurrentes générées ; ce n'est pas une opération atomique (suites d'appels séparés) | `create-period-with-budgets.use-case.ts:101-108` | ✅ partiel `create-period-with-budgets.use-case.spec.ts` « should create and save a period with its budgets » |
| Si `injectRecurring` est vrai, chaque récurrente devient une transaction : jour du mois = jour de la récurrente, ramené au dernier jour du mois si le mois est plus court ; le mois pris est celui de la date de début ; ignorée si la date tombe hors de la période | `create-period-with-budgets.use-case.ts:62-98` | ❌ |
| Les transactions générées sont « en attente » (`pending`), non rapprochées, avec la mention d'origine `{source:'recurring', recurringId}` | `create-period-with-budgets.use-case.ts:92-94` | ❌ |
| Brouillon : début suggéré = lendemain de la fin de la dernière période (ou de son début si elle n'a pas de fin), sinon aujourd'hui ; fin suggérée = début + 1 mois - 1 jour | `get-period-draft.use-case.ts:31-40` | ✅ `get-period-draft.use-case.spec.ts` « should suggest dates… » |
| Brouillon : montant par défaut d'une catégorie = moyenne historique ; s'il existe des récurrentes dans cette catégorie, = somme de leurs montants à la place | `get-period-draft.use-case.ts:64-70` | ✅ « …use avgReal when no recurring… » et « …prioritize recurring transactions sum… » |
| Brouillon : toutes les catégories du compte sont listées (stat à 0 si aucun historique) | `get-period-draft.use-case.ts:54-58` | ✅ « should include category stats… » |
| Remplacer les budgets : supprime tous les budgets de la période puis recrée ceux fournis, en ignorant les montants égaux à 0 | `update-period-budgets.use-case.ts:21-37` | ❌ |
| À la création le montant 0 n'est PAS filtré (contrairement au remplacement) | `create-period-with-budgets.use-case.ts:52-58` | ❌ |
| Le corps de la création est validé (`CreatePeriodBodyDto`, sans `accountId`) : dates ISO, `budgets` obligatoire (liste, même vide), `injectRecurring` booléen facultatif ; champ inconnu, `accountId` ou `budgets` absent → 400 (le compte vient uniquement de l'URL) | `periods.controller.ts:78-80,212-230` | ✅ e2e `validation.e2e-spec.ts` |
| Montants en centimes, reçus en texte puis convertis en entier | `periods.controller.ts:48,154,227` | ❌ |
| Une transaction ajoutée sans période reçoit automatiquement la période marquée active du compte | base : `supabase/migrations/20251229111000_add_period_id_to_expenses.sql:9-37` (trigger `assign_period_id`, renommé `set_transactions_period_id` dans `20260307000000_migrate_to_v2.sql`) | ❌ |
| Supprimer une période supprime ses budgets ; ses transactions perdent leur période (restent) ; supprimer un compte supprime ses périodes | `20251229112000_create_budget_instances_table.sql:3` (CASCADE), `20251229111000...sql:3` (SET NULL), `20251229110500_create_periods_table.sql:3` | ❌ |
| Accès en base : lecture/écriture selon l'accès au compte (propriétaire ou partage) | `20251229110500_create_periods_table.sql:16-30` | ❌ |

## Ce qu'on stocke
Période (table `periods`) : id ; compte ; date de début ; date de fin (peut être vide) ; `estimated_end_date` (colonne présente en base, non utilisée par le code) ; active oui/non ; dates de création/modification. Dates enregistrées sans heure (`YYYY-MM-DD`, `supabase-period.repository.ts:69`). Budgets : voir `docs/budgets.md`.

## Ce qu'on peut faire
Qui : toutes les routes exigent un token de connexion valide (`@UseGuards(SupabaseAuthGuard)`, `periods.controller.ts:107` ; stratégie JWT `functions/src/auth/supabase.strategy.ts:61`). Pas de middleware global ni de décorateur d'identité : le contrôleur ne lit pas l'utilisateur. Les droits sont contrôlés uniquement en base (RLS) car le client Supabase porte le token de l'utilisateur (`functions/src/supabase/supabase.module.ts:25-38`). Les routes `GET/PATCH/DELETE :id` et `GET/PUT :id/budgets` vérifient que la période appartient à `:accountId` (`account-ownership.ts`) : inexistante ou d'un autre compte = 404 identique, sans écriture.

| Action | Point d'entrée | Effet | Source |
| --- | --- | --- | --- |
| Lister les périodes | `GET /:accountId/periods` | tri par début décroissant | `periods.controller.ts:118`, `supabase-period.repository.ts:52` |
| Brouillon | `GET /:accountId/periods/draft-init` | dates suggérées + stats par catégorie | `periods.controller.ts:125` |
| Budgets d'une période | `GET /:accountId/periods/:id/budgets` | liste (id, catégorie, montant) | `periods.controller.ts:134` |
| Remplacer les budgets | `PUT /:accountId/periods/:id/budgets` | voir règle | `periods.controller.ts:146` |
| Lire une période | `GET /:accountId/periods/:id` | renvoie la période ou rien | `periods.controller.ts:165` |
| Modifier (dates, active) | `PATCH /:accountId/periods/:id` | met à jour ; ne désactive pas les autres périodes quand on réactive | `periods.controller.ts:169` |
| Supprimer | `DELETE /:accountId/periods/:id` | supprime | `periods.controller.ts:205` |
| Créer avec budgets | `POST /:accountId/periods` | voir règles ; renvoie id, dates, nombre de budgets | `periods.controller.ts:212` |

Front (`frontend/src/features/periods/`) : liste (`ui/period-list.tsx`) avec « clôturer » (PATCH `isActive:false`, après confirmation navigateur), édition des dates, suppression (confirmation), édition des budgets (`ui/edit-period-budgets-sheet.tsx`) et création (`ui/create-period-dialog.tsx`, pré-remplie par le brouillon, montants saisis convertis par `toCents`). Hooks : `usePeriods` (dans `features/budgets`), `usePeriodDraft`, `usePeriodBudgets`, `useCreatePeriod`, `useUpdatePeriod`, `useUpdatePeriodBudgets`, `useDeletePeriod`. Après création/modification, le front rafraîchit aussi les transactions et le reporting.

## Statuts et transitions
Active / inactive (`is_active`). Création : la nouvelle est active, les autres actives passent inactives. Clôture : active -> inactive via PATCH. Rien n'interdit (code lu) de réactiver une période inactive par PATCH ni d'avoir alors plusieurs actives.

## Zones d'ombre
- Les périodes peuvent-elles se chevaucher ? Aucun contrôle trouvé (code ni base).
- Réactiver une période laisse-t-il volontairement plusieurs périodes actives ? Non traité.
- Pourquoi le montant 0 est filtré au remplacement mais pas à la création : inconnu.
- La date du jour du brouillon est calculée côté serveur avec son fuseau ; l'effet sur les dates n'est pas précisé.
- Les erreurs « Period not found » sont des `NotFoundError` (`periods.controller.ts:184`) → 404.
- Le comportement du trigger `assign_period_id` (condition exacte de choix de la période) se lit dans la migration ; la prise en compte de la date de la transaction n'y figure pas (commentaire d'hésitation, lignes 22-24).
