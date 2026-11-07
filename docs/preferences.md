# Préférences — module supprimé (la disposition du tableau de bord n'existe plus)

Mise à jour : 2026-11-07 · Commit : refonte-mobile (procédure de mise en prod : un seul `db push`) ; avant : 6de5e32 (refonte de l'écran Aujourd'hui)

## Ce qui a changé
L'écran Aujourd'hui est devenu fixe (voir `reporting.md`) : plus de bouton Personnaliser, de catalogue de widgets, ni de choix de largeur ou de visibilité bureau/mobile. Le module qui mémorisait cette disposition par utilisateur a donc été retiré du code.

| Élément | État | Source |
| --- | --- | --- |
| Module back `PreferencesModule` (`functions/src/preferences/`) | supprimé, retiré de `app.module.ts` | `git diff 88a0832..HEAD -- functions/src/preferences functions/src/app.module.ts` |
| Routes `GET /preferences` et `PATCH /preferences` | n'existent plus (404) | idem |
| Front `frontend/src/features/preferences/` (catalogue, store d'édition `useDashboardStore`, éditeur par glisser-déposer, filtre `visible-layout`) | supprimé ; bloc `useDashboardStore` retiré de `shared/model/stores.test.ts` | idem |
| Textes `Dashboard.widgets.*`, `customize`, `layout_title`, `available_widgets`, `show/hide_*` | retirés de `messages/{fr,en}.json` | commit `6de5e32` |
| Vérification réelle `http/tableau-de-bord-allege.http` | supprimée | idem |
| Test SQL `supabase/tests/widen_balance_cards_test.sql` | supprimé ; `utility_functions_privileges_test.sql` ne cite plus `widen_balance_cards` | idem |
| Table `user_preferences` et fonction `public.widen_balance_cards(jsonb)` | **toujours en base** : la migration qui les supprime est écrite mais pas appliquée | `supabase/migrations/20261106100000_drop_user_preferences.sql` |

## Migration `20261106100000_drop_user_preferences.sql`
- Contenu : `DROP FUNCTION IF EXISTS public.widen_balance_cards(jsonb)` puis `DROP TABLE IF EXISTS public.user_preferences`.
- État : écrite, **non appliquée** (livraison par commits locaux, sans push, release ni `supabase db push`, tant que toute la refonte, front et back, n'est pas terminée : spec `refonte-mobile`).
- Ordre à la mise en prod (remplace l'ancien « migration après le déploiement ») : **un seul `supabase db push`, avant le déploiement**, avec la migration `20261107100000_replace_period_budgets_expected.sql` (objets différents, fichiers indépendants). Étapes : (1) `supabase migration list` pour voir ce qui attend déjà en prod (si des migrations plus anciennes attendent, par exemple `20261105100000_reset_budget_templates.sql` qui vide `budget_templates`, traiter d'abord leurs prérequis, voir `periods.md`) ; (2) `supabase db push --dry-run` doit lister `…106` puis `…107` ; (3) un seul `db push`, sans les passer une par une : appliquer `…107` avant `…106` ferait refuser `…106` (plus ancienne que la dernière appliquée) sans `--include-all` ; (4) tout de suite après, déployer le back puis le front (le nouveau front envoie `expectedBudgets`, que seul le nouveau back accepte) ; (5) vérifier en réel (Aujourd'hui, enregistrement d'un budget 200 puis 409, saisie mobile, 404 des 5 anciennes adresses, `http/aujourdhui.http` avec `/preferences` en 404, `http/budgets-simulation.http`). Source : `specs/refonte-mobile/spec.md`, section Exploitation.
- Fenêtre entre le `db push` et le déploiement : la table n'existe plus. L'ancien back ne peut plus lire `/preferences` (erreur attendue, non vérifiée) et l'ancien front casse sur l'écran Aujourd'hui jusqu'au déploiement ; les autres écrans ne lisent pas cette table. Risque accepté par Lucas (« tout en une fois »).
- **Perte assumée, sans export** : les dispositions enregistrées dans `user_preferences` ne sont pas sauvegardées avant la suppression (réponse de Lucas).
- Retour arrière : avant application, `git revert` des commits du cycle ; après application, la suppression est irréversible et aucune sauvegarde n'est faite (les dispositions par utilisateur sont perdues, `user_preferences` ne revient pas ; `replace_period_budgets` se recrée à 2 paramètres d'après l'en-tête de sa migration). Testée : ❌ (pas de test de la migration).
- Tant qu'elle n'est pas appliquée, la table et ses lignes existent mais plus aucun code ne les lit ni ne les écrit.

## Zones d'ombre
- La procédure de mise en prod n'a pas été jouée ; l'état de la prod (migrations déjà appliquées) ne se lit pas depuis le dépôt.
- Les zones d'ombre du cycle 2 (sort de `/preferences`, de la table, des dispositions enregistrées ; correspondance des anciens widgets ; repères de visite) sont closes : tout est supprimé, la visite guidée a été réalignée (voir `tour.md`).
- Aucune mesure n'existe sur l'usage passé de la personnalisation (masquer un widget sur mobile ou bureau) : sa suppression n'a pas été mesurée.
