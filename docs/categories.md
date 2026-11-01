# Catégories — classer ses transactions (dépenses, revenus, virements, épargne)

Mise à jour : 2026-11-01 · Commit : fc285ef

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Catégorie | Étiquette unique d'une transaction (ex. « Courses »), propre à un compte. |
| Type | `expense` (dépense), `income` (revenu), `transfer` (virement), `savings` (épargne). |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Le nom est obligatoire (pas vide ni que des espaces) | `functions/src/categories/domain/category.entity.ts:44-46` | ✅ `category.entity.spec.ts` « should throw error if name is empty » |
| Le type doit être l'une des 4 valeurs | `category.entity.ts:47-49` ; DTO `@IsEnum(CategoryType)` (`categories.controller.ts:49`) ; en base `supabase/migrations/20260307000000_migrate_to_v2.sql:32` (contrainte CHECK `categories_type_check`) | ❌ côté code ; base non testée |
| La couleur doit être au format hexadécimal `#RRGGBB` | `category.entity.ts:50-52` ; DTO `IsHexColor` `categories.controller.ts:45` ; couleur invalide → 400 (e2e `validation.e2e-spec.ts`) | ✅ « should throw error if color is invalid hex » |
| Le nom (création **et modification**) est limité à 255 caractères (colonne `varchar(255)`) : sinon 400 « name must be shorter than or equal to 255 characters » (sans cela : 500). Un nom blanc reste refusé par l'entité (ligne ci-dessus) | `categories.controller.ts` (DTO) | ✅ e2e `validation.e2e-spec.ts`, `http/entrees-invalides.http` |
| Le corps de la création est validé (`CreateCategoryBodyDto`, sans `accountId`) : nom, couleur `#RRGGBB`, type (enum) ; champ inconnu (dont `budget` : le plafond de catégorie a été retiré, le budget est celui de la période, voir `periods`), ou `accountId` → 400, le compte vient uniquement de l'URL | `categories.controller.ts:59-61,148-160` | ✅ e2e `validation.e2e-spec.ts` |
| Le type d'une catégorie peut être changé après création | `categories.controller.ts:77-80` (DTO), `:138` (`type: dto.type ?? existing.type`) | ❌ (seule la validité du type à la création est couverte par l'entité) |
| Création et lecture passent par des cas d'usage ; la modification passe directement par le dépôt (`CategoryRepository`), sans cas d'usage | `categories.controller.ts:115-146` | ❌ |
| Accès en base : lecture si accès « read » au compte, écriture si « write » (propriétaire = tout) | `20251221_schema_complete.sql:208-223` (RLS, 4 politiques dont suppression), `:140` (`has_account_access`) | ❌ |
| `updated_at` mis à jour automatiquement par la base | `20251221_schema_complete.sql:85-88` (trigger `set_categories_updated_at`, fonction `handle_updated_at` `:76`) | ❌ |
| Modification partielle : un champ non envoyé garde sa valeur | `categories.controller.ts:131-142` (`update`) | ✅ e2e `functions/test/validation.e2e-spec.ts:753` (« description null removes the value, absent keeps it ») |
| `null` refusé en 400 sur `name`, `color` et `type` en modification. `description: null` **retire** la valeur ; champ absent = inchangé (remplace l'ancienne règle « impossible de vider ») | `categories.controller.ts:64-81` (`UpdateCategoryDto`, `@IsOptionalNotNull()`) | ✅ `functions/test/validation.e2e-spec.ts` (« null on a field that cannot be null », « description null removes the value, absent keeps it »), `http/null-refuse.http` |

## Ce qu'on stocke
Catégorie (table `categories`) : id ; nom ; description (texte, peut être vide) ; couleur (`#RRGGBB`) ; type ; compte propriétaire (`account_id`, supprimée avec le compte) ; dates de création et modification. (`functions/src/categories/domain/category.entity.ts`, ligne de base décrite par `CategoryRow` dans `supabase-category.repository.ts:7`)

## Ce qu'on peut faire
Qui : Toutes les routes exigent un token de connexion valide (`@UseGuards(SupabaseAuthGuard)`, `categories.controller.ts:96` ; stratégie JWT : `functions/src/auth/supabase.strategy.ts:61`). Il n'y a pas de middleware global ni de décorateur d'identité dans ce module : l'identité n'est pas lue par le contrôleur. Le contrôle des droits se fait en base : le client Supabase est créé par requête avec le token de l'utilisateur (`functions/src/supabase/supabase.module.ts:25-40`), donc les règles RLS s'appliquent (propriétaire du compte ou compte partagé, via `has_account_access`, `supabase/migrations/20251221_schema_complete.sql:140`). Le contrôleur ne vérifie pas que `:accountId` appartient à l'utilisateur, mais `PATCH :id` exige que la catégorie appartienne à `:accountId` : inexistante, d'un autre compte ou globale (`accountId` nul) = 404 identique, sans écriture (`account-ownership.ts`).

| Action | Point d'entrée | Effet | Source |
| --- | --- | --- | --- |
| Lister les catégories d'un compte | `GET /:accountId/categories` | liste complète, sans pagination ni tri | `categories.controller.ts:105` |
| Créer | `POST /:accountId/categories` | crée et renvoie la catégorie ; le compte vient de l'URL | `categories.controller.ts:148` |
| Modifier | `PATCH /:accountId/categories/:id` | met à jour ; la catégorie `:id` doit appartenir à `:accountId` (sinon 404, voir « Qui ») | `categories.controller.ts:115` |
| Supprimer | aucune route | le dépôt sait supprimer (`delete`) mais aucune route ne l'expose | `category.repository.interface.ts:7` |

Écrans (front, `frontend/src/features/categories/`) : liste en cartes avec création et édition (`ui/category-list.tsx`, `ui/create-category-dialog.tsx`), sélecteur de catégorie réutilisable (`ui/category-selector.tsx`) : l'API renvoie la liste sans tri, c'est le sélecteur qui la trie à l'affichage par ordre alphabétique français, accents et majuscules ignorés (`category-selector.tsx:44-53` ; le tri est calculé une fois par liste reçue et partagé entre tous les sélecteurs) ; un champ de recherche garde les catégories dont le nom contient le texte tapé (mêmes règles accents/casse, ex. « ele » trouve « Électricité », `:73-77`), le texte est vidé à chaque ouverture (`:80-83`) ; « Sans catégorie » (`Categories.selector.none`) est toujours en tête, hors tri, et masqué pendant une recherche (`:128`) ; sans résultat, message « Aucune catégorie trouvée » (`:124-126`) ; le choix se fait par identifiant (et non par le nom), donc la catégorie cliquée est celle renvoyée quel que soit le tri ou la recherche, « Sans catégorie » renvoyant une valeur vide (`:85-88,129,135`). Il est utilisé par le formulaire de transaction, les filtres de transactions, les récurrentes (création et liste), les règles intelligentes (création et liste) et l'étape de validation de l'import. Couvert par `ui/category-selector.test.tsx`. Hooks : `useCategories`, `useCreateCategory`, `useUpdateCategory` (clé de cache `['categories', accountId]`, rafraîchie après création/modification). Le type front `Category` ne contient ni description ni budget (`model/types.ts`). Une carte affiche la couleur, le nom et le bouton d'édition, sans montant (l'ancien « 0,00 € » écrit en dur a été retiré ; couvert par `ui/category-list.test.tsx`).

## Statuts et transitions
Pas de cycle de vie.

## Zones d'ombre
- Le nom n'est pas unique : le code et la base lus (création) n'empêchent pas deux catégories de même nom dans un compte.
- Pourquoi une catégorie n'est pas supprimable depuis l'application : inconnu (route absente). Effet d'une suppression directe en base sur les transactions : à voir dans le module transactions (hors périmètre).
- Une catégorie introuvable (ou d'un autre compte, ou globale) à la modification renvoie 404 (`NotFoundError` levée par `ensureBelongsToAccount`, `categories.controller.ts:125-129`).
