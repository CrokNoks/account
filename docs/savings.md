# Objectifs d'épargne — fixer un montant cible (avec une date limite facultative) et suivre la progression

Mise à jour : 2026-10-30 · Commit : 157b272

Code : back `functions/src/savings-goals/`, front `frontend/src/features/savings/`, base `supabase/migrations/`.

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Objectif d'épargne | Une somme à atteindre (ex. « Vacances »), rattachée à un compte. |
| Montant cible / montant actuel | Ce qu'on veut atteindre / ce qui est déjà mis de côté. En centimes entiers. |
| Échéance (`deadline`) | Date limite facultative, sans heure. |
| Trigger | Règle automatique de la base de données : elle s'exécute seule quand une transaction est ajoutée, modifiée ou supprimée. |
| RLS | Règle de sécurité de la base : chaque ligne n'est visible/modifiable que si l'utilisateur a accès au compte. |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Un objectif exige un compte, un nom non vide et un montant cible strictement positif (sinon erreur). | `functions/src/savings-goals/domain/savings-goal.entity.ts:37-44` | ❌ |
| Couleur par défaut `#3b82f6` si aucune n'est donnée. | `savings-goal.entity.ts:28`, `application/savings-goals.use-cases.ts:39` | ❌ |
| Le montant actuel d'un nouvel objectif vaut 0. | `savings-goal.entity.ts:58` | ❌ |
| Les montants sont envoyés en texte numérique (`IsNumberString`) puis convertis en grands entiers. | `infrastructure/savings-goals.controller.ts:35-51`, `use-cases.ts:35` | ❌ |
| Modification : seuls les champs fournis changent ; `deadline: null` efface l'échéance ; un champ vide (texte vide) est ignoré. Objectif inconnu : erreur « Savings goal not found ». | `use-cases.ts:67-86` | ❌ |
| Un objectif lié à une transaction voit son montant actuel recalculé par la base : à l'ajout d'une transaction liée, `montant actuel = montant actuel − montant de la transaction` (une dépense négative fait donc monter l'épargne). | `supabase/migrations/20260318143724_sync_savings_goals_trigger.sql:6-27` | ❌ |
| Modification d'une transaction : l'effet de l'ancienne version est annulé (+ ancien montant sur l'ancien objectif) puis le nouveau est appliqué (− nouveau montant sur le nouvel objectif). Suppression : effet annulé. | idem (lignes 8-22) | ❌ |
| Si un objectif est supprimé, les transactions liées gardent leur existence et perdent le lien (`ON DELETE SET NULL`). | `20260318131922_link_transactions_to_savings.sql:4` | ❌ |
| La date de mise à jour est renseignée automatiquement à chaque modification. | `20260316000002_smart_rules_and_savings_goals.sql:38-41` ; le trigger d'épargne la met aussi à jour | ❌ |
| Accès base (RLS) : toutes les opérations (lecture comprise) exigent le droit « écriture » sur le compte (propriétaire, ou partage en écriture). | `20260316000002_smart_rules_and_savings_goals.sql:32-34`, définition `has_account_access` dans `20260106081523_remote_schema.sql:48-73` | ❌ |
| Front : pourcentage = montant actuel / cible, arrondi, plafonné à 100 %. | `frontend/src/features/savings/ui/savings-goals-widget.tsx:42-44`, `savings-goals-list.tsx:68-70` | ❌ |
| Front : « Contribuer » ajoute la somme saisie au montant actuel et envoie la nouvelle valeur totale via PATCH (n'ajoute pas de transaction). | `savings-goals-list.tsx:40-55` | ❌ |

Aucun test dans `savings-goals/` ni `features/savings/`.

## Ce qu'on stocke
Table `savings_goals` (`20260316000002_...sql:17-26`) : `id`, `account_id` (suppression en cascade avec le compte), `name`, `target_amount` (centimes), `current_amount` (centimes, défaut 0), `deadline` (date, facultatif), `color`, `created_at`, `updated_at`.
Table `transactions` : colonne `savings_goal_id` (lien facultatif, indexé).
Réponse API : montants renvoyés en texte, dates en ISO.

## Ce qu'on peut faire
Toutes les routes sont derrière `SupabaseAuthGuard` (jeton Supabase valide exigé ; l'identité est `{id, email}` lue dans le jeton). Aucun middleware, et le code ne vérifie pas que l'`accountId` de l'URL appartient à l'utilisateur (c'est la RLS de la base, ci-dessous) ; en revanche, en modification/suppression, l'objectif doit appartenir à `:accountId` (`account-ownership.ts`) : inexistant ou d'un autre compte = 404 identique, sans écriture. La RLS s'applique car le client base de données est créé par requête avec l'en-tête `Authorization` de l'appelant (`functions/src/supabase/supabase.module.ts`).

| Action | Point d'entrée | Qui | Effet | Source |
| --- | --- | --- | --- | --- |
| Lister | `GET /:accountId/savings-goals` | connecté ; accès au compte via RLS seulement | objectifs, du plus récent au plus ancien | `savings-goals.controller.ts:82`, repo `:25-35` |
| Créer | `POST /:accountId/savings-goals` (name, targetAmount, deadline?, color?) | idem | crée l'objectif | `controller:89` |
| Modifier | `PATCH /:accountId/savings-goals/:id` | idem ; `accountId` de l'URL ignoré | modifie | `controller:102` |
| Supprimer | `DELETE /:accountId/savings-goals/:id` | idem ; `accountId` ignoré | supprime sans passer par un cas d'usage | `controller:109` |

Écrans : widget tableau de bord « Objectifs d'épargne » (`savings-goals-widget.tsx`, id `savings` dans `preferences/config/dashboard-widgets.tsx`), liste avec édition / suppression / contribution (`savings-goals-list.tsx`), création (`create-savings-goal-dialog.tsx`). Hooks React Query : `api/use-savings-goals.ts` (clé `['savings-goals', accountId]`, invalidée après chaque écriture). Les saisies passent par `toCents` / `fromCents` ; une saisie non vide et illisible (création, modification, contribution) est refusée avec un message d'erreur au lieu d'être enregistrée comme 0 (le champ de contribution est un champ texte, qui accepte `12,50`).

## Statuts et transitions
Pas de statut. Un objectif atteint (≥ 100 %) reste modifiable ; rien ne l'archive ni ne l'empêche de dépasser la cible.

## Zones d'ombre
- Deux façons de changer le montant actuel coexistent : le trigger (via les transactions liées) et le PATCH `currentAmount` (bouton « Contribuer », édition). Le code ne dit pas comment elles doivent cohabiter ; le PATCH écrase la valeur calculée par le trigger sans créer de transaction.
- Où et comment une transaction est liée à un objectif (`savings_goal_id`) : le lien existe en base, mais ce périmètre ne l'expose pas.
- Le trigger ne tient pas compte de `pending` / `reconciled` : toute transaction liée compte.
- Pourquoi la lecture exige le droit « écriture » : un compte partagé en lecture seule ne verrait aucun objectif ; intention inconnue.
- Suppression et modification d'un objectif : la propriété du compte est contrôlée côté back (404 sinon).
