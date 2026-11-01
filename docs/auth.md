# Auth — vérifie que l'appelant est connecté et transmet son identité à la base

Mise à jour : 2026-10-30 · Commit : 157b272

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Token (JWT) | Jeton signé délivré par Supabase à la connexion, envoyé dans l'en-tête `Authorization: Bearer ...` |
| Guard | Barrière Nest qui refuse la requête si le token est absent ou invalide |
| RLS | Règles de sécurité de la base : chaque requête n'y voit que les lignes auxquelles l'utilisateur a droit |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Une route protégée exige un token Bearer valide et non expiré | `functions/src/auth/supabase-auth.guard.ts:5`, `supabase.strategy.ts:38-39` | ❌ |
| Le token est vérifié avec un secret partagé (HS256) seulement si un secret est configuré ET que l'URL Supabase n'est pas locale ; sinon avec les clés publiques Supabase (JWKS) | `functions/src/auth/supabase.strategy.ts:23-26,39-49` | ❌ |
| Un token sans identifiant utilisateur (`sub`) est refusé | `supabase.strategy.ts:62-67` | ❌ |
| L'identité exposée est `{ id, email }` tirée du token | `supabase.strategy.ts:70-71`, `authenticated-request.interface.ts` | ❌ |
| Les logs ne contiennent jamais l'email, ni le token : un refus d'authentification journalise seulement sa raison (ex. `jwt expired`), sans identifiant | `supabase-auth.guard.ts`, `supabase.strategy.ts`, test `supabase.strategy.spec.ts` | ✅ |
| Le même token est recopié dans le client Supabase de la requête, donc la base applique les règles RLS de cet utilisateur | `functions/src/supabase/supabase.module.ts:27-37` | ❌ |
| Sans token, le client Supabase est créé quand même avec la clé anonyme (le guard bloque avant, sur les routes protégées) | `supabase.module.ts:27-37` | ❌ |
| Front : sans session, toute page redirige vers `/login` ; connecté sur `/login`, redirigé vers `/` | `frontend/src/shared/lib/supabase/middleware.ts:44-56` | ❌ |
| Front : chaque appel API ajoute le token de la session | `frontend/src/shared/api/api-client.ts:21` | ❌ |

## Ce qu'on stocke
Rien dans ce module. Les comptes utilisateurs sont ceux de Supabase Auth ; la table `app_users` (id, email) est alimentée automatiquement par un trigger à chaque création/modification d'utilisateur (`supabase/migrations/20251221_schema_complete.sql:311-357`, fonction `sync_app_users`).

## Ce qu'on peut faire
| Action | Point d'entrée | Qui | Effet | Source |
| --- | --- | --- | --- | --- |
| Se connecter | formulaire `LoginForm` (email + mot de passe), appel direct à Supabase (pas l'API Nest) | personne (public) | session créée, puis rechargement complet vers `/` (`window.location.assign` avec URL absolue, voulu : le middleware lit le cookie de session côté serveur et le cache client ne doit rien garder de l'utilisateur précédent) | `frontend/src/features/auth/ui/login-form.tsx:19-40` ; ✅ `login-form.test.tsx` |
| Protéger une route | `@UseGuards(SupabaseAuthGuard)` | connecté (token exigé) | `req.user` rempli | `functions/src/auth/auth.module.ts` |

Il n'y a ni middleware Nest d'authentification ni décorateur d'identité (`@User`) : les contrôleurs lisent `req.user` posé par le guard. L'identité n'est donc lue que si le guard est présent sur la route.

## Zones d'ombre
- Aucune route de l'API n'est publique côté module `auth` ; les autres modules (hors périmètre ici) n'ont pas été vérifiés un par un pour la présence du guard.
- Le front n'a pas d'inscription ni de réinitialisation de mot de passe : le code ne dit pas comment les utilisateurs sont créés.
- Le contrôle de rôle/propriétaire n'est pas dans ce module : il est dans la base (RLS), voir `accounts.md`.
