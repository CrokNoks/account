# Périodes — découper la vie d'un compte en périodes (souvent un mois), avec un budget par catégorie et des transactions récurrentes injectées

Mise à jour : 2026-11-01 · Commit : fc285ef

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
| Une période a un compte ; la fin ne peut pas précéder le début (même jour accepté, fin vide acceptée) | `functions/src/periods/domain/period.entity.ts:36-40` | ✅ `period.entity.spec.ts` (4 cas) |
| Une période créée est active par défaut | `period.entity.ts:67` | ❌ |
| Créer une période désactive les autres périodes actives du compte, puis enregistre la période, ses budgets (si au moins un) et les transactions récurrentes générées : tout est fait par la fonction SQL `create_period_with_budgets(p_period, p_budgets, p_transactions)` (`PeriodRepository.createWithBudgets`) en une seule transaction ; si une étape échoue (budget en double → 409, RLS…), rien n'est modifié et les périodes précédentes restent actives | `create-period-with-budgets.use-case.ts`, `supabase/migrations/20261030100100_atomic_create_period.sql` | ✅ `create-period-with-budgets.use-case.spec.ts`, `supabase-period.repository.spec.ts` |
| Si `injectRecurring` est vrai, chaque récurrente devient une transaction : jour du mois = jour de la récurrente, ramené au dernier jour du mois si le mois est plus court (helper partagé `shared/domain/recurring-day.ts`) ; le mois pris est celui de la date de début ; ignorée si la date tombe hors de la période | `create-period-with-budgets.use-case.ts:54-89` | ✅ partielle : `create-period-with-budgets.use-case.spec.ts` (transactions générées transmises à l'appel atomique ; récurrentes non lues sans `injectRecurring`) ; calcul du jour ❌ (voir `recurring-day.spec.ts`) |
| Les transactions générées sont « en attente » (`pending`), non rapprochées, avec la mention d'origine `{source:'recurring', recurringId}`. Voulu (Lucas) : `pending` = facture à venir (ex. une récurrente générée) : affichée, exclue du solde à venir et du solde en banque, mais comptée dans le solde prévisionnel (« ça force à ranger les transactions ») ; non rapprochée et non `pending` = CB/prélèvement déjà fait, en attente d'exécution, compté dans le solde à venir (calculs : `docs/reporting.md`). Ne pas générer les récurrentes en `pending: false` | `create-period-with-budgets.use-case.ts:82-84` | ✅ partielle : `create-period-with-budgets.use-case.spec.ts` (« passes the pending transactions generated from recurring ones… ») |
| Création : chaque catégorie citée par un budget doit appartenir au compte de l'URL, sinon 400 sans écriture (`AccountReferencesService.ensureCategories`) | `create-period-with-budgets.use-case.ts:33-36` | ✅ `create-period-with-budgets.use-case.spec.ts` (« refuses a budget category of another account without any write »), e2e `cross-account-references.e2e-spec.ts` |
| Brouillon : début suggéré = lendemain de la fin de la dernière période (ou de son début si elle n'a pas de fin), sinon aujourd'hui ; fin suggérée = début + 1 mois - 1 jour ; la « dernière période » est celle dont la date de fin est la plus récente (`findLastByAccount`, tri sur `end_date`) | `get-period-draft.use-case.ts:34-45`, `supabase-period.repository.ts:62-70` | ✅ `get-period-draft.use-case.spec.ts` « should suggest dates… » |
| Brouillon : montant par défaut d'une catégorie = moyenne historique ; s'il existe des récurrentes dans cette catégorie, = somme de leurs montants à la place | `get-period-draft.use-case.ts:59-75` | ✅ « …use avgReal when no recurring… » et « …prioritize recurring transactions sum… » |
| Brouillon : toutes les catégories du compte sont listées (stat à 0 si aucun historique) | `get-period-draft.use-case.ts:51-53,59-85` | ✅ « should include category stats… » |
| Remplacer les budgets : supprime tous les budgets de la période puis recrée ceux fournis (montants égaux à 0 ignorés, `update-period-budgets.use-case.ts:32`), en une seule transaction via la fonction SQL `replace_period_budgets(p_period_id, p_budgets)` (`BudgetRepository.replaceForPeriod`) ; si l'insertion échoue (catégorie en double → 409, RLS), les anciens budgets sont conservés | `update-period-budgets.use-case.ts`, `supabase/migrations/20261030100200_atomic_replace_period_budgets.sql` | ✅ `update-period-budgets.use-case.spec.ts`, `supabase-budget.repository.spec.ts` |
| À la création le montant 0 n'est PAS filtré (contrairement au remplacement) | `create-period-with-budgets.use-case.ts:46-52` | ❌ |
| Chaque `amountAllocated` de budget (création, remplacement des budgets) est reçu en chaîne d'entier de centimes signé dans ±(2^53 − 1) (`@IsCents` / `parseCents`, `shared/`), décimal, notation scientifique ou hors bornes → 400, « -0 » lu comme 0 | `periods.controller.ts` (`BudgetInitDto`), `shared/domain/cents.ts` | ✅ e2e `validation.e2e-spec.ts` |
| Le corps de la création est validé (`CreatePeriodBodyDto`, sans `accountId`) : dates `YYYY-MM-DD` existant au calendrier (`@IsCalendarDate` ; création et modification ; jour inexistant comme `2026-04-31` → 400 au lieu d'être décalé ; vérifié en réel `http/dates-calendaires.http`), `budgets` obligatoire (liste, même vide), `injectRecurring` booléen facultatif ; champ inconnu, `accountId` ou `budgets` absent → 400 (le compte vient uniquement de l'URL) | `periods.controller.ts:57-85,237-262` | ✅ e2e `validation.e2e-spec.ts` |
| Montants en centimes, reçus en texte puis convertis en entier | `periods.controller.ts:50,169,252` (`parseCents`) | ✅ e2e `validation.e2e-spec.ts` |
| Une transaction ajoutée sans période reçoit automatiquement la période marquée active du compte | base : `supabase/migrations/20251229111000_add_period_id_to_expenses.sql:9-37` (trigger `assign_period_id`, renommé `set_transactions_period_id` dans `20260307000000_migrate_to_v2.sql`) | ❌ |
| Supprimer une période supprime ses budgets ; ses transactions perdent leur période (restent) ; supprimer un compte supprime ses périodes | `20251229112000_create_budget_instances_table.sql:3` (CASCADE), `20251229111000...sql:3` (SET NULL), `20251229110500_create_periods_table.sql:3` | ❌ |
| Accès en base : lecture/écriture selon l'accès au compte (propriétaire ou partage) | `20251229110500_create_periods_table.sql:16-30` | ❌ |
| `null` refusé en 400 sur `startDate`, `endDate`, `isActive` en modification et sur `injectRecurring` à la création (absent = inchangé) ; une période ouverte (`end_date` NULL) n'est pas créable par l'API | `periods.controller.ts` (`@IsOptionalNotNull()`) | ✅ `functions/test/validation.e2e-spec.ts` (« null on a field that cannot be null »), `http/null-refuse.http` |

## Ce qu'on stocke
Période (table `periods`) : id ; compte ; date de début ; date de fin (peut être vide) ; `estimated_end_date` (colonne présente en base, non utilisée par le code) ; active oui/non ; dates de création/modification. Dates enregistrées sans heure (`YYYY-MM-DD`, `supabase-period.repository.ts:96-98,118-120`). Budgets : voir `docs/budgets.md`.

## Ce qu'on peut faire
Qui : toutes les routes exigent un token de connexion valide (`@UseGuards(SupabaseAuthGuard)`, `periods.controller.ts:112` ; stratégie JWT `functions/src/auth/supabase.strategy.ts:61`). Pas de middleware global ni de décorateur d'identité : le contrôleur ne lit pas l'utilisateur. Les droits sont contrôlés uniquement en base (RLS) car le client Supabase porte le token de l'utilisateur (`functions/src/supabase/supabase.module.ts:25-40`). Les routes `GET/PATCH/DELETE :id` et `GET/PUT :id/budgets` vérifient que la période appartient à `:accountId` (`account-ownership.ts`) : inexistante ou d'un autre compte = 404 identique, sans écriture.

| Action | Point d'entrée | Effet | Source |
| --- | --- | --- | --- |
| Lister les périodes | `GET /:accountId/periods` | tri par début décroissant | `periods.controller.ts:123`, `supabase-period.repository.ts:79-85` |
| Brouillon | `GET /:accountId/periods/draft-init` | dates suggérées + stats par catégorie | `periods.controller.ts:130` |
| Budgets d'une période | `GET /:accountId/periods/:id/budgets` | liste (id, catégorie, montant) | `periods.controller.ts:139` |
| Remplacer les budgets | `PUT /:accountId/periods/:id/budgets` | voir règle | `periods.controller.ts:155` |
| Lire une période | `GET /:accountId/periods/:id` | renvoie la période ; inexistante ou d'un autre compte : 404 | `periods.controller.ts:180` |
| Modifier (dates, active) | `PATCH /:accountId/periods/:id` | met à jour ; réactiver une période alors qu'une autre est active renvoie 409 « Another period is already active for this account » (il faut d'abord clôturer l'autre) | `periods.controller.ts:190` |
| Supprimer | `DELETE /:accountId/periods/:id` | supprime | `periods.controller.ts:221` |
| Créer avec budgets | `POST /:accountId/periods` | voir règles ; renvoie id, dates, nombre de budgets | `periods.controller.ts:237` |

Front (`frontend/src/features/periods/`) : liste (`ui/period-list.tsx`) avec « clôturer » (PATCH `isActive:false`, après confirmation navigateur), édition des dates, suppression (confirmation), édition des budgets (`ui/edit-period-budgets-sheet.tsx`) et création (`ui/create-period-dialog.tsx`, pré-remplie par le brouillon, montants saisis convertis par `toCents` ; un budget illisible bloque l'envoi avec un message d'erreur, aussi à l'édition des budgets). Hooks : `usePeriods` (dans `features/budgets`), `usePeriodDraft`, `usePeriodBudgets`, `useCreatePeriod`, `useUpdatePeriod`, `useUpdatePeriodBudgets`, `useDeletePeriod`. Après création/modification, le front rafraîchit aussi les transactions et le reporting.

## Statuts et transitions
Active / inactive (`is_active`). Création : la nouvelle est active, les autres actives passent inactives. Clôture : active -> inactive via PATCH. Réactiver une période par PATCH est possible seulement si aucune autre n'est active (voir « Une seule période active »).

## Pas de chevauchement
Deux périodes d'un même compte ne peuvent pas se chevaucher : contrainte d'exclusion `periods_no_overlap` (migration `20261031100100_periods_no_overlap.sql`, extension `btree_gist`) sur `account_id` et `daterange(start_date, end_date, '[]')`. Bornes incluses (une période qui commence le jour où une autre finit est refusée) ; `end_date` NULL = période ouverte à l'infini. La base fait foi, donc aussi sous concurrence : deux créations identiques simultanées donnent un 201 et un 409. Création (`createWithBudgets`) et PATCH des dates (`save`) renvoient 409 « Period overlaps an existing period » (`supabase-error.ts`, code Postgres 23P01 ; `supabase-period.repository.ts`). Tests : `supabase-period.repository.spec.ts`, `supabase-error.spec.ts` ; scénarios réels : `http/periodes-sans-chevauchement.http`.
Avant `supabase db push` en production : vérifier qu'aucune période existante ne se chevauche, sinon la migration échoue (par compte, deux lignes dont les intervalles `[start_date, end_date]` se recoupent).

## Une seule période active
Index unique partiel `periods_one_active_per_account` sur `periods (account_id) WHERE is_active` (migration `20261031100200_periods_one_active.sql`). La base fait foi, donc aussi sous concurrence : deux réactivations simultanées de deux périodes donnent un 200 et un 409. Violation (code Postgres 23505) : 409 « Another period is already active for this account » en PATCH (`save`) comme en création (`createWithBudgets`) ; le choix du message selon la contrainte est dans `periodConflict` (`supabase-period.repository.ts`), les messages de chevauchement (23P01) et de budget en double sont inchangés. La création n'est pas gênée : `create_period_with_budgets` désactive les autres actives avant d'insérer. Tests : `supabase-period.repository.spec.ts` ; scénarios réels : `http/periode-active-unique.http`.
Avant `supabase db push` en production : `select account_id from periods where is_active group by 1 having count(*)>1` doit renvoyer 0 ligne, sinon la migration échoue.

## Zones d'ombre
- Les `categoryId` des budgets reçus en body doivent être des UUID : sinon 400 (voir `transactions.md`). Ceux de la route (`:accountId`, `:id`) le sont aussi (voir `transactions.md`).
- Pourquoi le montant 0 est filtré au remplacement mais pas à la création : inconnu.
- La date du jour du brouillon est la date calendaire du fuseau métier (`APP_TIME_ZONE`, `Europe/Paris` par défaut), identique quel que soit le fuseau du serveur (`shared/domain/date-only.ts`).
- Les erreurs « Period not found » sont des `NotFoundError` levée par `ensureBelongsToAccount` (`periods.controller.ts:229-234`) → 404.
- Le comportement du trigger `assign_period_id` (condition exacte de choix de la période) se lit dans la migration ; la prise en compte de la date de la transaction n'y figure pas (commentaire d'hésitation, lignes 22-24).
