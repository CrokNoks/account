# Règles intelligentes — classer automatiquement une transaction d'après sa description

Mise à jour : 2026-10-30 · Commit : 157b272

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Règle intelligente | « Si la description contient X, alors catégorie Y et étiquettes Z ». |
| Motif (pattern) | Le texte cherché dans la description. |
| Priorité | Entier ; plus il est grand, plus la règle passe en premier. |
| Étiquettes (tags) | Identifiants d'étiquettes ajoutées à la transaction (module tags, hors périmètre). |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Une règle correspond si la description contient le motif, sans tenir compte des majuscules (simple « contient », pas d'expression régulière) | `functions/src/smart-rules/domain/smart-rule.entity.ts:57-63` | ❌ |
| Les règles sont essayées de la plus haute priorité à la plus basse ; la première qui correspond gagne, les autres sont ignorées | `match-smart-rules.use-case.ts:17-27` | ❌ |
| Aucune correspondance : catégorie vide, aucune étiquette | `match-smart-rules.use-case.ts:29` | ❌ |
| À l'import/création en masse, si la transaction n'a pas de catégorie, la règle fournit catégorie et étiquettes (celles de la règle s'ajoutent à celles déjà données) | `functions/src/transactions/application/bulk-create-transactions.use-case.ts:28-37` | ❌ (ici) |
| La prédiction de catégorie essaie les règles en premier (avant tout autre moyen) | `functions/src/transactions/application/predict-category.use-case.ts:21-28` | ❌ (ici) |
| Création : catégorie vide si non fournie, étiquettes vides, priorité 0 par défaut | `smart-rules.controller.ts:92-98` | ❌ |
| Le motif n'est pas contrôlé (une chaîne vide est acceptée par le code ; le front bloque le bouton si vide) | `smart-rule.entity.ts` (pas de validation) ; `frontend/.../create-smart-rule-dialog.tsx:153` | ❌ |
| Modification partielle : seuls les champs envoyés changent ; règle absente = 404 | `smart-rules.controller.ts:107-113` | ❌ |
| Supprimer un compte supprime ses règles ; supprimer une catégorie laisse la règle sans catégorie | `supabase/migrations/20260316000002_smart_rules_and_savings_goals.sql:7,9` | ❌ |
| Accès en base : une seule règle RLS « FOR ALL » exigeant l'accès **écriture** au compte, donc la simple lecture d'un compte partagé en lecture seule est aussi refusée | `20260316000002_smart_rules_and_savings_goals.sql:19-21` | ❌ |
| Aucun test dans ce module | (aucun `*.spec.ts` dans `functions/src/smart-rules/`) | ❌ |

## Ce qu'on stocke
Table `smart_rules` : id ; compte ; motif (texte) ; catégorie (peut être vide) ; étiquettes (liste d'identifiants, vide par défaut) ; priorité (entier, 0 par défaut) ; dates de création/modification (trigger `updated_at`, ligne 44). Aucun montant.

## Ce qu'on peut faire
Qui : toutes les routes exigent un token de connexion valide (`@UseGuards(SupabaseAuthGuard)`, `smart-rules.controller.ts:71`). Pas de middleware ni de décorateur d'identité : le contrôleur ne lit pas l'utilisateur. Droits contrôlés uniquement en base (RLS), le client Supabase portant le token de l'utilisateur (`functions/src/supabase/supabase.module.ts:25-38`). En modification/suppression, la règle doit appartenir à `:accountId` (`account-ownership.ts`) : inexistante ou d'un autre compte = 404 identique, sans écriture.

| Action | Point d'entrée | Effet | Source |
| --- | --- | --- | --- |
| Lister | `GET /:accountId/smart-rules` | triées par priorité décroissante | `smart-rules.controller.ts:79`, `supabase-smart-rule.repository.ts:29` |
| Créer | `POST /:accountId/smart-rules` | crée | `smart-rules.controller.ts:86` |
| Modifier | `PATCH /:accountId/smart-rules/:id` | modification partielle | `smart-rules.controller.ts:104` |
| Supprimer | `DELETE /:accountId/smart-rules/:id` | supprime | `smart-rules.controller.ts:119` |
| Appliquer les règles | pas de route : cas d'usage interne `MatchSmartRulesUseCase` | utilisé par le module transactions | `match-smart-rules.use-case.ts:11` |

Front (`frontend/src/features/smart-rules/`) : liste avec création/modification/suppression (confirmation navigateur) (`ui/smart-rules-list.tsx`), dialogue de création (`ui/create-smart-rule-dialog.tsx`). Hooks `useSmartRules`, `useCreateSmartRule`, `useUpdateSmartRule`, `useDeleteSmartRule` (clé `['smart-rules', accountId]`).

## Statuts et transitions
Pas de cycle de vie.

## Zones d'ombre
- Deux règles de même priorité : l'ordre entre elles dépend de l'ordre renvoyé par la base (tri stable non garanti par le code).
- Quand une règle donne une catégorie vide mais des étiquettes, la prédiction de catégorie renvoie quand même un résultat (voir `predict-category.use-case.ts:26`) ; l'intention n'est pas documentée.
- À la création et à la modification, la catégorie et les étiquettes citées doivent appartenir au compte de l'URL : sinon 400 sans écriture (`AccountReferencesService`, `smart-rules.controller.ts`) ; e2e `cross-account-references.e2e-spec.ts`.
- Les règles ne sont pas rejouées sur les transactions déjà existantes (aucun code trouvé).
- « Regex plus tard » : commentaire du code (`smart-rule.entity.ts:61`), pas de décision confirmée.
