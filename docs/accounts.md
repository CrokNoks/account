# Accounts — comptes bancaires de l'utilisateur et partage avec d'autres personnes

Mise à jour : 2026-10-30 · Commit : 157b272

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Compte | Un portefeuille (courant, épargne, espèces) qui contient des transactions |
| Propriétaire | Celui qui a créé le compte (`owner_id`) |
| Partage | Droit donné à un autre utilisateur sur un compte : `read` (lecture) ou `write` (lecture + écriture) |
| Solde initial | Montant du compte avant la première transaction, en centimes |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Un compte a un nom obligatoire ; solde initial 0 par défaut | `functions/src/accounts/domain/account.entity.ts:22`, `accounts.controller.ts:28-30` | ✅ `account.entity.spec.ts` |
| Le propriétaire d'un compte créé est l'utilisateur du token | `accounts.controller.ts:184` (`req.user.id`) | ✅ use case seul : `create-account.use-case.spec.ts` |
| Le solde initial est envoyé en texte numérique (centimes) et converti en grand entier | `accounts.controller.ts:58,189-191` | ❌ |
| La liste des comptes ne filtre pas dans le code : elle s'appuie sur la base, qui renvoie comptes possédés + partagés avec soi | `supabase-account.repository.ts:40-53`, `20260106081523_remote_schema.sql` (policy « Users can view accounts… ») | ✅ `get-accounts.use-case.spec.ts` (repo simulé) |
| Seul le propriétaire peut partager un compte | `application/share-account.use-case.ts:27` | ❌ |
| On ne peut partager qu'avec un utilisateur existant (déjà connecté au moins une fois, trouvé par email dans `app_users`) | `share-account.use-case.ts:31-36` | ❌ |
| On ne peut pas partager avec soi-même | `share-account.use-case.ts:38-42` | ❌ |
| Repartager avec la même personne remplace sa permission (une seule ligne par compte+utilisateur) | `supabase-account-share.repository.ts:51` (upsert avec `onConflict: 'account_id,user_id'`, sans quoi la base refusait le doublon : 500), contrainte `UNIQUE(account_id, user_id)` `20251221_schema_complete.sql:121` | ❌ |
| Seul le propriétaire peut retirer un partage | `accounts.controller.ts:128-137` | ❌ |
| Modifier un compte : réservé au propriétaire (403 sinon, 404 si le compte est inconnu ou invisible) ; seuls les champs fournis changent (nom, description, solde initial) | `accounts.controller.ts` (`update`, `assertOwner`) | ✅ e2e `cross-account-references.e2e-spec.ts` |
| En base : voir un compte = propriétaire ou partagé ; créer = être propriétaire du compte créé ; modifier/supprimer = propriétaire | `supabase/migrations/20251221_schema_complete.sql:168-186` | ❌ |
| En base : fonction `has_account_access(compte, 'read'|'write')` : vrai si propriétaire ; sinon si partage de même permission (un `write` donne aussi `read`). Utilisée par les règles des autres tables (transactions, tags) | `20260106081523_remote_schema.sql:48-70` | ❌ |
| En base : les partages sont gérables/visibles par le propriétaire ; un utilisateur voit aussi les partages qui le concernent | `20260106081523_remote_schema.sql:75-95` | ❌ |
| En base : `app_users` lisible par tout utilisateur connecté | `20251221_schema_complete.sql:321` | ❌ |

## Ce qu'on stocke
- Compte (`accounts`) : id, nom, propriétaire, description (optionnelle, ajoutée `20260311100000`), solde initial (centimes, BIGINT depuis `20260307000000_migrate_to_v2.sql:14-15`), dates de création/modification.
- Partage (`account_shares`) : id, compte, utilisateur, permission (`read`|`write`), date. Suppression du compte supprime ses partages (CASCADE).
- Utilisateur (`app_users`) : id, email (copie de l'auth Supabase).
- Front : un solde initial non vide et illisible est refusé avec un message d'erreur (création et modification) au lieu d'être enregistré comme 0.
- Front : compte actif et période active mémorisés dans le navigateur (`features/accounts/model/use-account-store.ts`) ; changer de compte remet la période à vide.

## Ce qu'on peut faire
Toutes les routes : connecté (token exigé via `@UseGuards` sur le contrôleur, `accounts.controller.ts:94`). Pas de middleware ni de décorateur d'identité ; `req.user` vient du guard (voir `auth.md`).

| Action | Point d'entrée | Qui | Effet | Source |
| --- | --- | --- | --- | --- |
| Lister mes comptes | `GET /accounts` | connecté ; filtrage par la base (RLS) | comptes possédés + partagés | `accounts.controller.ts:210` |
| Créer un compte | `POST /accounts` | connecté, devient propriétaire | compte créé | `accounts.controller.ts:180` |
| Modifier un compte | `PATCH /accounts/:id` | connecté + propriétaire contrôlé (403 sinon, 404 si le compte n'existe pas), sans écriture en cas de refus | compte mis à jour | `accounts.controller.ts:145` |
| Voir les partages | `GET /accounts/:id/shares` | connecté + propriétaire contrôlé (403 sinon, 404 si le compte n'existe pas) | liste avec email | `accounts.controller.ts:105` |
| Partager | `POST /accounts/:id/shares` (email, permission) | connecté + propriétaire contrôlé | partage créé/mis à jour | `share-account.use-case.ts` |
| Retirer un partage | `DELETE /accounts/:id/shares/:userId` | connecté + propriétaire contrôlé | partage supprimé | `accounts.controller.ts:128` |
| Écrans front | `account-list`, `account-form`, `create-account-dialog`, `share-account-dialog`, `account-selector` ; hooks `use-accounts`, `use-create-account`, `use-update-account`, `use-account-shares`, `use-manage-share` | | | `frontend/src/features/accounts/` |

Il n'y a pas de route pour supprimer un compte (la base l'autoriserait au propriétaire).

## Zones d'ombre
- Un compte n'a ni type ni devise : ces colonnes n'existent pas en base et l'API rejette ces champs (400, `forbidNonWhitelisted`). Le front ne les envoie plus à la création (`create-account-dialog.tsx`) : le formulaire ne demande que nom, solde initial et description, et la liste des comptes n'affiche plus de type ni de devise.
- Front : les boutons « partager » et « modifier » de `account-list.tsx` ne s'affichent que pour le propriétaire (`account.ownerId` comparé à l'utilisateur de la session Supabase, `features/auth/api/use-current-user-id.ts`) ; tant que l'utilisateur n'est pas connu, ils sont masqués. Test : `account-list.test.tsx`.
- Le type front `AccountShare` dans `model/types.ts` (rôles owner/viewer/editor) diffère de celui de `use-account-shares.ts` (read/write) ; le second correspond à l'API.
- Erreurs métier typées (`functions/src/shared/domain/errors.ts`), traduites par `DomainExceptionFilter` : compte ou utilisateur (email) introuvable → 404, partage/suppression de partage par un non-propriétaire → 403, partage avec soi-même → 400. Toutes les écritures des repositories Supabase passent par `toDomainError` (`functions/src/shared/infrastructure/supabase-error.ts`) : refus RLS (Postgres `42501`) → 403 « You do not have permission to modify this resource » (sans détail de policy), clé étrangère (`23503`) → 400 « Referenced resource does not exist », `23505` → 409 (message propre à chaque contrainte), `P0002` → 404 ; toute autre erreur technique reste un 500 « Internal server error ». Les lectures sont inchangées.
- Le PATCH met à jour avec `dto.description ?? existant` : impossible d'effacer une description.
- `balance` apparaît dans le type front `Account` mais n'est jamais renvoyé par ces routes ; d'où il vient n'est pas dans ce module.
