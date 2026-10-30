# Tags — étiquettes libres, propres à chaque compte, pour regrouper des transactions

Mise à jour : 2026-10-30 · Commit : 157b272

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Tag | Étiquette (nom + couleur) créée sur un compte et posée sur des transactions, en plus de la catégorie |
| Récapitulatif de tags | Pour chaque tag : nombre de transactions et total (calculé par le module `reporting`) |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Un tag exige un nom non vide et un compte | `functions/src/tags/domain/tag.entity.ts:28-38` | ❌ |
| La couleur, si présente, est au format hexadécimal `#RRGGBB` (contrôlé aussi à l'entrée de l'API) | `tag.entity.ts:32`, `infrastructure/tags.controller.ts:31` | ❌ |
| A la création, la couleur est facultative côté API ; absente, le tag reçoit `#94a3b8` (la même couleur que les résumés de tags). Fournie, elle doit rester un hexadécimal valide, sinon 400. | `tags.controller.ts:26-37`, `application/create-tag.usecase.ts` (`DEFAULT_TAG_COLOR`) | ✅ `tags.usecases.spec.ts` (couleur par défaut), e2e `front-contract.e2e-spec.ts` |
| Un nom de tag est unique dans un compte | `supabase/migrations/20260313092403_create_tags_tables.sql:9` (`UNIQUE(account_id, name)`) ; violation → 409 dans `supabase-tag.repository.ts` | ✅ `supabase-tag.repository.spec.ts` |
| Modifier : seuls nom et couleur changent ; tag inconnu → 404 | `application/update-tag.usecase.ts:15-28` | ❌ |
| Supprimer un tag le retire de toutes les transactions (liaison en cascade) | `20260313092403_create_tags_tables.sql:13-17` | ❌ |
| En base : lire les tags = accès `read` au compte ; créer/modifier/supprimer = accès `write` (propriétaire ou partagé `write`) | `20260313092403_create_tags_tables.sql:25-39` | ❌ |
| En base : mêmes droits pour la liaison transaction-tag, via le compte de la transaction | `20260313092403_create_tags_tables.sql:43-79` | ❌ |
| Poser des tags sur une transaction : voir `transactions.md` (remplacement complet à chaque enregistrement, atomique via `save_transaction`) | `supabase-transaction.repository.ts` (`save`) | ❌ |

## Ce qu'on stocke
Tag (`tags`) : id, compte, nom (50 caractères max), couleur (7 caractères, `#RRGGBB`), dates de création/modification (mise à jour automatique par trigger `set_tags_updated_at`). Liaison `transaction_tags` (transaction, tag).

## Ce qu'on peut faire
Qui : connecté (token exigé, `@UseGuards(SupabaseAuthGuard)`, `tags.controller.ts:59`) ; pas de middleware ni de décorateur d'identité, l'identité n'est pas lue. Les droits sur le compte sont appliqués uniquement par la base (RLS) ; le code ne vérifie pas l'accès à `:accountId`. En modification/suppression, le tag doit appartenir à `:accountId` (`account-ownership.ts`) : inexistant ou d'un autre compte = 404 identique, sans écriture.

| Action | Point d'entrée | Qui | Effet | Source |
| --- | --- | --- | --- | --- |
| Lister les tags d'un compte | `GET /:accountId/tags` | connecté + RLS | liste | `tags.controller.ts:69` |
| Créer | `POST /:accountId/tags` (nom, couleur facultative) | connecté + RLS (`write`) | tag créé | `:79` |
| Modifier | `PATCH /:accountId/tags/:id` | idem ; le compte de l'URL n'est pas comparé à celui du tag | tag mis à jour | `:93` |
| Supprimer | `DELETE /:accountId/tags/:id` | idem | tag supprimé | `:107` |
| Récapitulatif par tag | `GET /:accountId/reporting/tags-summary?periodId=` | module `reporting` (hors périmètre) | utilisé par le front | `frontend/src/features/tags/api/use-tags-summary.ts` |
| Détail d'un tag | `GET /:accountId/reporting/tags/:tagId?periodId=` | idem | idem | `use-tag-details.ts` |

Front (`frontend/src/features/tags/`) : `tag-list`, `create-tag-dialog`, `tag-detail-drawer`, `tag-stats-summary`, `tag-selector` (choix de tags dans un formulaire, avec création à la volée du tag saisi) ; hooks `use-tags`, `use-create-tag`, `use-update-tag`, `use-delete-tag`, `use-tags-summary`, `use-tag-details`.

## Zones d'ombre
- Création à la volée : le `tag-selector` crée un tag avec seulement un nom (`tag-selector.tsx:52-55`) ; l'API accepte maintenant ce cas et applique la couleur par défaut `#94a3b8`. Ce gris est choisi par le back, l'utilisateur ne le voit pas choisir. Si la création échoue, la notification affiche le message renvoyé par l'API (par exemple un nom déjà pris), à défaut un message traduit.
- Aucun test ne couvre le module tags.
- Le nom unique par compte est une contrainte base : sa violation (code Postgres 23505) est traduite par le repository en `ConflictError` → 409 « A tag with this name already exists » (création et renommage), testé dans `supabase-tag.repository.spec.ts` et e2e `validation.e2e-spec.ts`. Un tag introuvable à la modification renvoie 404 (`NotFoundError`).
- Rien n'empêche, dans le code, un nom composé d'espaces seulement côté API (`IsString` seul) ; l'entité le refuse ensuite.
- Le calcul des récapitulatifs vit dans `reporting`, non lu ici.
