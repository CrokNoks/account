# Préférences — mémorise la disposition du tableau de bord de chaque utilisateur

Mise à jour : 2026-11-01 · Commit : fc285ef

Code : back `functions/src/preferences/`, front `frontend/src/features/preferences/`, base `supabase/migrations/20260316000000..03` et `20261101100600_widen_balance_cards.sql`.

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Widget | Un bloc du tableau de bord (solde, anomalies, répartition du budget…). |
| Largeur (`width`) | Place occupée sur une grille de 12 colonnes (2, 3, 4, 6 ou 12 côté écran d'édition). |
| Visible bureau / mobile | Deux cases par widget pour l'afficher ou non selon l'appareil. |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Si l'utilisateur n'a pas de préférences, la lecture en crée et en enregistre avec la disposition par défaut (9 widgets : `stat-bank`, `stat-upcoming`, `stat-income` en largeur 4, `net-worth` et `upcoming` en 6, `anomalies` en 12, `breakdown` et `tags` en 6, `transactions` en 12), identique à `DEFAULT_WIDGETS` du front. Depuis le 2026-11-01 : les 6 cartes de solde sont réduites à 3 (`stat-start` fusionné en sous-titre de `stat-bank`, `stat-forecast` en sous-titre de `stat-upcoming`, `stat-expenses` fusionné dans `stat-income` qui affiche revenus et dépenses) et `pulse` / `top-expenses` sont retirés ; les ids retirés d'une disposition enregistrée sont ignorés à l'affichage comme `insights` (voir la règle front plus bas). Les dispositions déjà enregistrées ont ensuite été élargies par une migration de données (règle suivante). Le défaut de la colonne en base (`20260316000003`) est ancien mais jamais utilisé : le back écrit toujours la disposition complète | `functions/src/preferences/domain/user-preferences.entity.ts` (`create`), `frontend/src/features/preferences/config/dashboard-widgets.tsx` (`DEFAULT_WIDGETS`) | ✅ `user-preferences.use-cases.spec.ts` (« provides a default dashboard… » : les 9 ids et largeurs), `visible-layout.test.ts` ; l'identité front/back des deux listes n'est pas testée |
| Migration de données `20261101100600_widen_balance_cards.sql` : dans les dispositions enregistrées (`user_preferences.dashboard_layout`), les widgets `stat-bank`, `stat-upcoming`, `stat-income` passent en largeur 4 (la carte à deux lignes était trop étroite à 2) ; ordre, autres widgets, visibilités, ids retirés et champs inconnus sont conservés ; une disposition nulle, sans tableau `widgets` ou au format ancien (liste de textes) est laissée telle quelle ; idempotente (ne réécrit que les lignes qui changent). Passe par la fonction SQL `public.widen_balance_cards(jsonb)`, qui n'est pas exécutable par l'API (`20261101100700_revoke_utility_functions.sql`). Retour arrière : remettre `"width": 2` sur ces 3 ids (indiqué dans l'en-tête de la migration) ; l'ancienne largeur n'est pas sauvegardée | `supabase/migrations/20261101100600_widen_balance_cards.sql`, `supabase/migrations/20261101100700_revoke_utility_functions.sql` | ✅ `supabase/tests/widen_balance_cards_test.sql` (psql : conversion type, ordre conservé, idempotence, un seul id, aucun id, vide, nul, format ancien, champs inconnus) ; ✅ `supabase/tests/utility_functions_privileges_test.sql` (droits) |
| À l'enregistrement, une visibilité absente est considérée « visible » (bureau et mobile). | `application/update-user-preferences.use-case.ts:23-27` | ✅ `user-preferences.use-cases.spec.ts` (« defaults missing visibility flags to true ») |
| Chaque widget doit avoir un `id` texte et une `width` numérique ; le contenu de la liste n'est pas contrôlé (pas de liste d'ids autorisés, pas de bornes sur la largeur). | `infrastructure/preferences.controller.ts:34-60` | ❌ (seul le `null` est testé, voir plus bas) |
| La disposition est enregistrée en entier (remplacement, pas de fusion). | `infrastructure/supabase-user-preferences.repository.ts:36-43` (upsert), `update-user-preferences.use-case.ts:29-38` | ✅ `user-preferences.use-cases.spec.ts` (« replaces the whole layout ») |
| Base : une ligne par utilisateur (clé = `user_id`, supprimée avec l'utilisateur) ; RLS : chacun ne voit / n'insère / ne modifie que sa ligne (aucune règle de suppression). | `20260316000000_create_user_preferences.sql:3,9-22` | ❌ |
| Le défaut en base a été remplacé deux fois, et ces migrations ont réinitialisé la disposition de tous les utilisateurs existants. | `20260316000001_...sql`, `20260316000003_...sql` (UPDATE sans condition ; le défaut de la colonne et ces UPDATE précèdent la disposition actuelle) | ❌ |
| Front : ajouter un widget l'ajoute en largeur 12, visible partout ; en retirer un le supprime de la liste. | `frontend/src/features/preferences/model/use-dashboard-store.ts:19-28` | ❌ |
| Front : une disposition enregistrée est filtrée sur les widgets connus du catalogue : un id inconnu (ex. `insights`, retiré avec les analyses IA, ou `savings`, retiré avec les objectifs d'épargne) est ignoré à l'affichage et en édition, les autres gardent ordre, largeur et visibilité. Rien n'est réécrit en base tant que l'utilisateur n'enregistre pas. | `frontend/src/features/preferences/model/visible-layout.ts`, utilisé dans `app/[locale]/(dashboard)/page.tsx:63-65` | ✅ `visible-layout.test.ts` (dont une disposition enregistrée contenant `savings` : ignoré à l'affichage et à l'édition, non proposé à l'ajout, autres widgets intacts) |
| Front : les modifications se font sur une copie temporaire (`tempLayout`), l'enregistrement passe par `useUpdateUserPreferences`. | `use-dashboard-store.ts`, `api/use-user-preferences.ts:30-43`, `app/[locale]/(dashboard)/page.tsx:98-99` | ❌ |
| `null` refusé en 400 sur `desktopVisible` et `mobileVisible` d'un widget (absent = inchangé) | `preferences.controller.ts` (`@IsOptionalNotNull()`) | ✅ `functions/test/validation.e2e-spec.ts` (« null on a field that cannot be null »), `http/null-refuse.http` |

Tests back : `user-preferences.use-cases.spec.ts` (disposition par défaut, lecture, création au premier accès, enregistrement, visibilité par défaut, remplacement complet). Côté front, seul `visible-layout.test.ts` existe. Les widgets du tableau de bord et leurs cartes de solde ne sont pas testés ici (voir `dashboard-stats.test.tsx` dans `docs/reporting.md`).

## Ce qu'on stocke
Table `user_preferences` : `user_id`, `dashboard_layout` (JSON `{widgets: [{id, width, desktopVisible, mobileVisible}]}`), `updated_at`. Aucun montant.

## Ce qu'on peut faire
Identité : `SupabaseAuthGuard` exige un jeton valide ; l'utilisateur est lu dans le jeton (`req.user.id`), jamais dans l'URL ou le corps, donc chacun ne touche que ses propres préférences. Pas de middleware.

| Action | Point d'entrée | Qui | Effet | Source |
| --- | --- | --- | --- | --- |
| Lire | `GET /preferences` | connecté, ses propres données | renvoie (ou crée) la disposition | `preferences.controller.ts:83` |
| Enregistrer | `PATCH /preferences` (corps `{widgets:[…]}`) | connecté, ses propres données | remplace la disposition | `preferences.controller.ts:99` |

Écrans : catalogue des widgets possibles et libellés (`config/dashboard-widgets.tsx`, `ALL_AVAILABLE_WIDGETS` : 9 widgets, tous présents dans la disposition par défaut) ; composants d'édition par glisser-déposer (`ui/dashboard-editor-components.tsx` : changement de largeur en boucle 2→3→4→6→12, bascule bureau/mobile). L'écran du tableau de bord (`app/[locale]/(dashboard)/page.tsx`) les utilise.

## Statuts et transitions
Mode lecture / mode édition côté front (`isEditing`), sans statut en base.

## Zones d'ombre
- Le catalogue front (9 widgets) et la liste côté back ne sont pas reliés : un `id` inconnu est enregistré tel quel par le back, mais le front l'ignore à l'affichage (voir règle ci-dessus).
- Les anciennes valeurs par défaut (`widgets: ["anomalies", …]`, liste de textes) ont existé ; le code actuel ne gère pas ce format.
- Pourquoi les largeurs 2 et 3 existent à l'édition alors que le défaut n'utilise que 4, 6 et 12 : inconnu.
