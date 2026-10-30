# Budgets — montant alloué à chaque catégorie pour une période, et statistiques passées

Mise à jour : 2026-10-30 · Commit : 157b272

Ce module n'a **aucun point d'entrée API propre** : il est utilisé par le module `periods` (voir `docs/periods.md`) qui expose les routes. Module Nest global (`@Global`, `functions/src/budgets/budgets.module.ts:6`).

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Budget (instance de budget) | Montant prévu pour une catégorie sur une période donnée. Une ligne = (période, catégorie, montant). |
| Montant alloué | Montant prévu, en centimes. Les tests utilisent des valeurs négatives pour une dépense (ex. -50000 = -500,00 €). |
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
| `save` écrase (upsert) ; l'écriture de plusieurs budgets passe par `replaceForPeriod` ou `createWithBudgets` (fonctions SQL atomiques) | `supabase-budget.repository.ts` | ❌ |

## Ce qu'on stocke
Budget (table `budget_instances`) : id ; période (`period_id`) ; catégorie (`category_id`) ; montant alloué (centimes) ; dates de création/modification (trigger `updated_at`, `20251229112000...sql:62`).

## Ce qu'on peut faire
Qui : voir `docs/periods.md` (les routes sont dans `periods.controller.ts`, connectées via token, droits par RLS ; la période doit appartenir à `:accountId`, 404 sinon).

| Action | Point d'entrée | Source |
| --- | --- | --- |
| Lire / remplacer les budgets d'une période, statistiques du brouillon | via `/:accountId/periods/...` | `functions/src/periods/infrastructure/periods.controller.ts:128,140` |

Front : `frontend/src/features/budgets/api/use-periods.ts` ne contient que le hook `usePeriods` (liste des périodes, `GET /:accountId/periods`) ; il n'y a pas d écran propre aux budgets (les écrans sont dans `features/periods`).

## Statuts et transitions
Pas de cycle de vie.

## Zones d'ombre
- Une table `budget_templates` existe en base (`20251229111500_create_budget_templates_table.sql`, convertie en centimes dans `migrate_to_v2.sql:58`) mais aucun code du back ni du front de ce périmètre ne l'utilise.
- Le signe des montants (dépense négative ou positive) n'est pas imposé par le code ; seuls des tests l'illustrent.
- Les statistiques ne distinguent pas dépenses/revenus ; la fonction SQL compte aussi les transactions « en attente ».
- Le filtre `!== 0` à l'enregistrement est commenté « Optional » (voir `periods`).
