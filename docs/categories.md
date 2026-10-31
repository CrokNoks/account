# Catégories — classer ses transactions (dépenses, revenus, virements, épargne) et fixer un plafond indicatif

Mise à jour : 2026-10-31 · Commit : df46659

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Catégorie | Étiquette unique d'une transaction (ex. « Courses »), propre à un compte. |
| Type | `expense` (dépense), `income` (revenu), `transfer` (virement), `savings` (épargne). |
| Budget (de catégorie) | Montant plafond optionnel porté par la catégorie, en centimes. Différent du budget alloué à une période (voir `periods`). |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Le nom est obligatoire (pas vide ni que des espaces) | `functions/src/categories/domain/category.entity.ts:45` | ✅ `category.entity.spec.ts` « should throw error if name is empty » |
| Le type doit être l'une des 4 valeurs | `category.entity.ts:48` ; en base `supabase/migrations/20260307000000_migrate_to_v2.sql:32` (contrainte CHECK) | ❌ côté code ; base non testée |
| La couleur doit être au format hexadécimal `#RRGGBB` | `category.entity.ts:51` ; DTO `IsHexColor` `categories.controller.ts:42` ; couleur invalide → 400 (e2e `validation.e2e-spec.ts`) | ✅ « should throw error if color is invalid hex » |
| Le budget est facultatif | `category.entity.ts:15` | ✅ « should allow null budget » |
| Le budget est reçu en chaîne d'entier de centimes signé 64 bits (`@IsCents` / `parseCents`, `shared/`), décimal, notation scientifique ou hors bornes → 400, « -0 » lu comme 0 (création et modification) | `categories.controller.ts` (DTO), `shared/domain/cents.ts` | ✅ e2e `validation.e2e-spec.ts` |
| Modification partielle : un champ non envoyé garde sa valeur ; impossible de vider la description ou le budget (valeur vide ignorée) | `categories.controller.ts:122-132` | ❌ |
| Le corps de la création est validé (`CreateCategoryBodyDto`, sans `accountId`) : nom, couleur `#RRGGBB`, type (enum), budget en centimes entiers (texte) ; champ inconnu ou `accountId` → 400, le compte vient uniquement de l'URL | `categories.controller.ts:64-66,144-156` | ✅ e2e `validation.e2e-spec.ts` |
| Le type d'une catégorie peut être changé après création | `categories.controller.ts:70,127` | ❌ |
| Création et lecture passent par des cas d'usage ; la modification passe directement par le dépôt, sans cas d'usage | `categories.controller.ts:119-134` | ❌ |
| Accès en base : lecture si accès « read » au compte, écriture si « write » (propriétaire = tout) | `20251221_schema_complete.sql:208-225` (RLS), `:140` | ❌ |
| Montant du budget stocké en centimes (BIGINT) | `20260307000000_migrate_to_v2.sql:35-36` | ❌ |
| `updated_at` mis à jour automatiquement par la base | `20251221_schema_complete.sql:86` (trigger `handle_updated_at`) | ❌ |

## Ce qu'on stocke
Catégorie (table `categories`) : id ; nom ; description (texte, peut être vide) ; couleur (`#RRGGBB`) ; type ; compte propriétaire (`account_id`, supprimée avec le compte) ; budget (centimes, peut être vide) ; dates de création et modification. (`functions/src/categories/domain/category.entity.ts`, `supabase-category.repository.ts:6`)

## Ce qu'on peut faire
Qui : Toutes les routes exigent un token de connexion valide (`@UseGuards(SupabaseAuthGuard)`, stratégie JWT : `functions/src/auth/supabase.strategy.ts:61`). Il n'y a pas de middleware global ni de décorateur d'identité dans ce module : l'identité n'est pas lue par le contrôleur. Le contrôle des droits se fait en base : le client Supabase est créé par requête avec le token de l'utilisateur (`functions/src/supabase/supabase.module.ts:25-38`), donc les règles RLS s'appliquent (propriétaire du compte ou compte partagé, via `has_account_access`, `supabase/migrations/20251221_schema_complete.sql:140`). Le contrôleur ne vérifie pas que `:accountId` appartient à l'utilisateur, mais `PATCH :id` exige que la catégorie appartienne à `:accountId` : inexistante, d'un autre compte ou globale (`accountId` nul) = 404 identique, sans écriture (`account-ownership.ts`).

| Action | Point d'entrée | Effet | Source |
| --- | --- | --- | --- |
| Lister les catégories d'un compte | `GET /:accountId/categories` | liste complète, sans pagination ni tri | `categories.controller.ts:102` |
| Créer | `POST /:accountId/categories` | crée et renvoie la catégorie ; le compte vient de l'URL | `categories.controller.ts:138` |
| Modifier | `PATCH /:accountId/categories/:id` | met à jour ; `:accountId` n'est pas utilisé, seule la catégorie `:id` est cherchée | `categories.controller.ts:112` |
| Supprimer | aucune route | le dépôt sait supprimer (`delete`) mais aucune route ne l'expose | `category.repository.interface.ts:7` |

Écrans (front, `frontend/src/features/categories/`) : liste en cartes avec création et édition (`ui/category-list.tsx`, `ui/create-category-dialog.tsx`), sélecteur de catégorie réutilisable (`ui/category-selector.tsx`) : l'API renvoie la liste sans tri, c'est le sélecteur qui la trie à l'affichage par ordre alphabétique français, accents et majuscules ignorés (`category-selector.tsx:50-55`) ; un champ de recherche garde les catégories dont le nom contient le texte tapé (mêmes règles accents/casse, ex. « ele » trouve « Électricité », `:54`), le texte est vidé à chaque ouverture (`:59`) ; « Sans catégorie » (`Categories.selector.none`) est toujours en tête, hors tri, et masqué pendant une recherche (`:105`) ; sans résultat, message « Aucune catégorie trouvée » (`:101-103`) ; le choix se fait par identifiant (et non par le nom), donc la catégorie cliquée est celle renvoyée quel que soit le tri ou la recherche, « Sans catégorie » renvoyant une valeur vide (`:62-65,106,112`). Il est utilisé par le formulaire de transaction, les filtres de transactions, les récurrentes (création et liste), les règles intelligentes (création et liste) et l'étape de validation de l'import. Couvert par `ui/category-selector.test.tsx`. Hooks : `useCategories`, `useCreateCategory`, `useUpdateCategory` (clé de cache `['categories', accountId]`, rafraîchie après création/modification). Le type front `Category` ne contient ni description ni budget (`model/types.ts`). Chaque carte affiche un montant fixé à `formatCurrency('0')` (`category-list.tsx:104`) : aucun total réel n'est calculé ici.

## Statuts et transitions
Pas de cycle de vie.

## Zones d'ombre
- Le nom n'est pas unique : le code et la base lus (création) n'empêchent pas deux catégories de même nom dans un compte.
- Pourquoi une catégorie n'est pas supprimable depuis l'application : inconnu (route absente). Effet d'une suppression directe en base sur les transactions : à voir dans le module transactions (hors périmètre).
- Le budget de catégorie : le code ne montre pas où il est consommé dans ce module (aucun calcul ici).
- Une catégorie introuvable à la modification renvoie 404 (`NotFoundError`, `categories.controller.ts:122`).
