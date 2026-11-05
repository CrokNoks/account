# Budgets — montant alloué à chaque catégorie pour une période, et statistiques passées

Mise à jour : 2026-11-05 · Commit : 83587d9

Ce module n'a **aucun point d'entrée API propre** : il est utilisé par le module `periods` (voir `docs/periods.md`) qui expose les routes, y compris celles des budgets fixes (`/:accountId/budget-templates`). Module Nest global (`@Global`, `functions/src/budgets/budgets.module.ts:6`).

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Budget (instance de budget) | Montant prévu pour une catégorie sur une période donnée. Une ligne = (période, catégorie, montant). |
| Montant alloué | Montant prévu, en centimes. Les tests utilisent des valeurs négatives pour une dépense (ex. -50000 = -500,00 €). |
| Budget fixe (modèle de budget, table `budget_templates`) | Montant configuré une fois par (compte, catégorie), proposé à chaque création de période. 0 = « non configuré ». |
| Statistiques historiques | Pour chaque catégorie : plus petit, plus grand et moyen total réellement dépensé par période, calculés sur les transactions passées. |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Un budget exige une période et une catégorie | `functions/src/budgets/domain/budget-instance.entity.ts:29-30` | ✅ `budget-instance.entity.spec.ts` (2 cas « should throw if … missing ») |
| Le montant doit être présent (0 est accepté par l'entité) | `budget-instance.entity.ts:31` | ❌ |
| Les catégories des budgets (création de période, `PUT /:accountId/periods/:id/budgets`) doivent appartenir au compte de l'URL, sinon 400 « Category does not belong to this account » avant toute écriture (les anciens budgets ne sont pas effacés) | `create-period-with-budgets.use-case.ts`, `update-period-budgets.use-case.ts` | ✅ specs + e2e `cross-account-references.e2e-spec.ts` |
| Un seul budget par couple (période, catégorie) | base : `supabase/migrations/20251229112000_create_budget_instances_table.sql:8` (UNIQUE) ; violation (23505) traduite en 409 « A budget already exists for this category in this period » par `supabase-budget.repository.ts` (`save`, `replaceForPeriod`) ; même traduction pour `createWithBudgets` côté périodes | ✅ `supabase-budget.repository.spec.ts`, `supabase-period.repository.spec.ts` |
| Supprimer une période ou une catégorie supprime ses budgets | `20251229112000_create_budget_instances_table.sql:3-4` (ON DELETE CASCADE) | ❌ |
| Montants stockés en centimes entiers (BIGINT) | `20260307000000_migrate_to_v2.sql:62-63` | ❌ |
| Accès en base : lecture/écriture selon l'accès au compte de la période (propriétaire ou partage) | `20251229112000_create_budget_instances_table.sql:21-59` | ❌ |
| Statistiques : total des transactions par (catégorie, période), puis min/max/moyenne par catégorie ; seules les transactions ayant catégorie ET période sont comptées ; tous types de transaction confondus | `20260307120000_create_budget_stats_func.sql:4-27` | ❌ |
| Si le calcul des statistiques échoue, on renvoie une liste vide sans erreur (simple avertissement dans les logs) ; la moyenne est arrondie | `functions/src/budgets/infrastructure/supabase-budget.repository.ts:114-129` | ❌ |
| Budget fixe : un seul par couple (compte, catégorie) (UNIQUE) ; montant en centimes (BIGINT), négatif accepté ; supprimer le compte ou la catégorie supprime la ligne | `20251229111500_create_budget_templates_table.sql:7,9,12`, `20260307000000_migrate_to_v2.sql:58-59` | ❌ |
| Budget fixe : lecture `findTemplatesByAccount` (catégorie, montant) ; écriture `saveTemplates` = un seul upsert sur (compte, catégorie), donc tout ou rien ; liste vide = aucune écriture ; erreurs traduites par `toDomainError` | `supabase-budget.repository.ts:135-166`, `budget.repository.interface.ts:38-49` | ✅ `supabase-budget.repository.spec.ts` (« budget templates ») |
| Montant proposé : à la création de période = configuré, sinon 0 (jamais moyenne ni récurrentes) ; à l'écran de configuration = configuré non nul, sinon somme des récurrentes de la catégorie. Règle écrite une seule fois | `functions/src/budgets/domain/proposed-amount.ts:7-22` | ✅ `proposed-amount.spec.ts` |
| Accès en base aux budgets fixes : lecture si accès « read » au compte, écriture (insertion, modification, suppression) si accès « write » | `20251229111500_create_budget_templates_table.sql:15-29` | ✅ réel : `http/budgets-fixes.http` (CA7) |
| Reprise (migration) : pour chaque compte, la période retenue est celle à `end_date` la plus récente (puis `start_date` la plus récente, puis `id`) ; chaque budget non nul de cette période est copié dans `budget_templates` si la ligne est absente ou à 0 ; une ligne non nulle n'est jamais écrasée ; budgets à 0 non copiés ; récurrentes jamais reprises ; une seule instruction (tout ou rien) ; rejouable sans doublon | `supabase/migrations/20261105100100_backfill_budget_templates.sql:5-16` | ✅ `supabase/tests/backfill_budget_templates_test.sql` (cas c1 à c8, compte B, compte sans période, rejeu ; lancement indiqué en tête du fichier) |
| Remise à zéro avant la reprise : la migration vide entièrement `budget_templates` (`DELETE` sans condition). Motif : les lignes existantes sont des restes jamais utilisés par le code (en production : 38 lignes, dernière mise à jour 2026-03-08 ; décision de Lucas). Aucune sauvegarde. **À ne jamais rejouer** après la mise en service : elle supprimerait les montants configurés. Elle s'exécute avant la reprise (horodatage 20261105100000 < 20261105100100), donc une ancienne ligne non nulle est supprimée, pas conservée | `supabase/migrations/20261105100000_reset_budget_templates.sql:1-5` | ✅ `supabase/tests/reset_then_backfill_budget_templates_test.sql` (ancienne ligne remplacée par le budget récent, ancienne ligne sans budget récent supprimée, compte sans période vidé, une seule ligne au final ; lancement indiqué en tête du fichier) |
| Reprise : le tri `end_date DESC` place les `end_date` NULL en premier (PostgreSQL, NULLS FIRST par défaut), donc une période ouverte serait retenue plutôt que la plus récente datée. En production (requête en prod du 2026-11-05, non visible dans le code) il n'y a qu'une seule période ouverte et c'est l'unique période de son compte : sans effet sur la reprise | `20261105100100_backfill_budget_templates.sql:10` | ❌ |
| `save` écrase (upsert) ; l'écriture de plusieurs budgets passe par `replaceForPeriod` ou `createWithBudgets` (fonctions SQL atomiques) | `supabase-budget.repository.ts` | ❌ |

## Ce qu'on stocke
Budget (table `budget_instances`) : id ; période (`period_id`) ; catégorie (`category_id`) ; montant alloué (centimes) ; dates de création/modification (trigger `updated_at`, `20251229112000...sql:62`).

## Ce qu'on peut faire
Qui : voir `docs/periods.md` (les routes sont dans `periods.controller.ts`, connectées via token, droits par RLS ; la période doit appartenir à `:accountId`, 404 sinon).

| Action | Point d'entrée | Source |
| --- | --- | --- |
| Lire / remplacer les budgets d'une période, statistiques du brouillon | via `/:accountId/periods/...` | `functions/src/periods/infrastructure/periods.controller.ts:128,140` |
| Lire / enregistrer les budgets fixes du compte | `GET` / `PUT /:accountId/budget-templates` (voir `docs/periods.md`, « Budgets fixes du compte ») | `functions/src/periods/infrastructure/budget-templates.controller.ts:57,69` |

Front : `frontend/src/features/budgets/api/use-periods.ts` ne contient que le hook `usePeriods` (liste des périodes, `GET /:accountId/periods`). Les écrans sont dans `features/periods`, dont l'écran des budgets fixes `/budgets/fixed` (`budget-templates-form.tsx`), accessible depuis la page `/budgets`.

Budget fixe (table `budget_templates`) : id ; compte ; catégorie ; montant (`amount_base`, centimes) ; `is_fixed` (colonne présente, non utilisée par le code) ; dates de création/modification.

## Mesure
Requête en lecture seule `supabase/queries/depassements-par-periode.sql` : par période, nombre de catégories budgétées et nombre en dépassement (total des transactions de la catégorie dans la période, hors `pending`, dépassant en valeur absolue le budget, y compris un budget à 0 ; les montants de signes différents s'additionnent donc un remboursement réduit la dépense). Sert à comparer avant/après la mise en service des budgets fixes. Non testée, vérifiée à la main (lancement indiqué en tête du fichier). Règle volontairement différente de la page `/depassements` (voir `docs/reporting.md`) : la requête compte les budgets à 0, tous les types de catégorie (revenus et virements compris) et relie les transactions par `period_id` ; la page exclut les budgets à 0 et les revenus/virements, rattache par dates et exige un réel négatif (un réel positif n'est jamais un dépassement). Les chiffres ne sont pas comparables ; la requête n'a pas été modifiée. La page se mesure par ses journaux `overruns_report_built` et `overruns_chart_built`.

## Statuts et transitions
Pas de cycle de vie.

## Zones d'ombre
- `budget_templates.is_fixed` (commentaire de la migration : « fixe » contre « variable ») n'est ni lu ni écrit par le code ; son sens métier n'est pas utilisé.
- Le signe des montants (dépense négative ou positive) n'est pas imposé par le code ; seuls des tests l'illustrent.
- Les statistiques min/moyenne/max ne servent plus au montant proposé, seulement à l'affichage indicatif.
- Les statistiques ne distinguent pas dépenses/revenus ; la fonction SQL compte aussi les transactions « en attente ».
- Le filtre `!== 0` à l'enregistrement est commenté « Optional » (voir `periods`).
