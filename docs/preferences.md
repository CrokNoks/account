# Préférences — mémorise la disposition du tableau de bord de chaque utilisateur

Mise à jour : 2026-11-01 · Commit : 0cc11db

Code : back `functions/src/preferences/`, front `frontend/src/features/preferences/`, base `supabase/migrations/20260316000000..03`.

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Widget | Un bloc du tableau de bord (solde, anomalies, répartition du budget…). |
| Largeur (`width`) | Place occupée sur une grille de 12 colonnes (2, 3, 4, 6 ou 12 côté écran d'édition). |
| Visible bureau / mobile | Deux cases par widget pour l'afficher ou non selon l'appareil. |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Si l'utilisateur n'a pas de préférences, la lecture en crée et en enregistre avec la disposition par défaut (12 widgets : 6 soldes en largeur 2, net-worth, pulse, anomalies, breakdown, top-expenses, transactions). | `functions/src/preferences/application/get-user-preferences.use-case.ts:14-19`, `domain/user-preferences.entity.ts:29-` | ❌ |
| À l'enregistrement, une visibilité absente est considérée « visible » (bureau et mobile). | `application/update-user-preferences.use-case.ts:24-28` | ❌ |
| Chaque widget doit avoir un `id` texte et une `width` numérique ; le contenu de la liste n'est pas contrôlé (pas de liste d'ids autorisés, pas de bornes sur la largeur). | `infrastructure/preferences.controller.ts:33-55` | ❌ |
| La disposition est enregistrée en entier (remplacement, pas de fusion). | `infrastructure/supabase-user-preferences.repository.ts:37-45` | ❌ |
| Base : une ligne par utilisateur (clé = `user_id`, supprimée avec l'utilisateur) ; RLS : chacun ne voit / n'insère / ne modifie que sa ligne. | `20260316000000_create_user_preferences.sql:2-21` | ❌ |
| Le défaut en base a été remplacé deux fois, et ces migrations ont réinitialisé la disposition de tous les utilisateurs existants. | `20260316000001_...sql`, `20260316000003_...sql` (UPDATE sans condition) | ❌ |
| Front : ajouter un widget l'ajoute en largeur 12, visible partout ; en retirer un le supprime de la liste. | `frontend/src/features/preferences/model/use-dashboard-store.ts:18-27` | ❌ |
| Front : une disposition enregistrée est filtrée sur les widgets connus du catalogue : un id inconnu (ex. `insights`, retiré avec les analyses IA, ou `savings`, retiré avec les objectifs d'épargne) est ignoré à l'affichage et en édition, les autres gardent ordre, largeur et visibilité. Rien n'est réécrit en base tant que l'utilisateur n'enregistre pas. | `frontend/src/features/preferences/model/visible-layout.ts`, utilisé dans `app/[locale]/(dashboard)/page.tsx:64` | ✅ `visible-layout.test.ts` (dont une disposition enregistrée contenant `savings` : ignoré à l'affichage et à l'édition, non proposé à l'ajout, autres widgets intacts) |
| Front : les modifications se font sur une copie temporaire (`tempLayout`), l'enregistrement passe par `useUpdateUserPreferences`. | `use-dashboard-store.ts`, `api/use-user-preferences.ts:30-43` | ❌ |

Aucun test dans `preferences/` (back) ; côté front, seul `visible-layout.test.ts` existe.

## Ce qu'on stocke
Table `user_preferences` : `user_id`, `dashboard_layout` (JSON `{widgets: [{id, width, desktopVisible, mobileVisible}]}`), `updated_at`. Aucun montant.

## Ce qu'on peut faire
Identité : `SupabaseAuthGuard` exige un jeton valide ; l'utilisateur est lu dans le jeton (`req.user.id`), jamais dans l'URL ou le corps, donc chacun ne touche que ses propres préférences. Pas de middleware.

| Action | Point d'entrée | Qui | Effet | Source |
| --- | --- | --- | --- | --- |
| Lire | `GET /preferences` | connecté, ses propres données | renvoie (ou crée) la disposition | `preferences.controller.ts:83` |
| Enregistrer | `PATCH /preferences` (corps `{widgets:[…]}`) | connecté, ses propres données | remplace la disposition | `preferences.controller.ts:99` |

Écrans : catalogue des widgets possibles et libellés (`config/dashboard-widgets.tsx`, 14 widgets dont `tags` et `upcoming` absents de la disposition par défaut) ; composants d'édition par glisser-déposer (`ui/dashboard-editor-components.tsx` : changement de largeur en boucle 2→3→4→6→12, bascule bureau/mobile). L'écran du tableau de bord (`app/[locale]/(dashboard)/page.tsx`) les utilise.

## Statuts et transitions
Mode lecture / mode édition côté front (`isEditing`), sans statut en base.

## Zones d'ombre
- Le catalogue front (14 widgets) et la liste côté back ne sont pas reliés : un `id` inconnu est enregistré tel quel par le back, mais le front l'ignore à l'affichage (voir règle ci-dessus).
- Les anciennes valeurs par défaut (`widgets: ["anomalies", …]`, liste de textes) ont existé ; le code actuel ne gère pas ce format.
- Pourquoi la largeur 3 et 4 existent à l'édition alors que le défaut n'utilise que 2, 6, 12 : inconnu.
