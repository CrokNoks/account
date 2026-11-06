# Préférences — module supprimé (la disposition du tableau de bord n'existe plus)

Mise à jour : 2026-11-06 · Commit : 6de5e32 (refonte de l'écran Aujourd'hui)

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
- État : écrite, **non appliquée** (livraison par commits locaux, sans `supabase db push`, selon la spec).
- Ordre à la mise en prod : **déployer d'abord le front et le back, puis appliquer la migration**. Le front actuellement en production lit `/preferences` : appliquer la migration avant le déploiement casserait son écran d'accueil.
- Retour arrière : avant application, `git revert` des commits du cycle ; après application, la suppression est irréversible sans sauvegarde de la table (les dispositions par utilisateur sont perdues). Testée : ❌ (pas de test de la migration).
- Tant qu'elle n'est pas appliquée, la table et ses lignes existent mais plus aucun code ne les lit ni ne les écrit.

## Zones d'ombre
- Les zones d'ombre du cycle 2 (sort de `/preferences`, de la table, des dispositions enregistrées ; correspondance des anciens widgets ; repères de visite) sont closes : tout est supprimé, la visite guidée a été réalignée (voir `tour.md`).
- Aucune mesure n'existe sur l'usage passé de la personnalisation (masquer un widget sur mobile ou bureau) : sa suppression n'a pas été mesurée.
