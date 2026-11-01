# Suppression des objectifs d'épargne

## Le problème
La fonctionnalité « objectifs d'épargne » n'est utilisée par personne (0 objectif, 0 transaction liée en base locale) mais elle coûte du code à maintenir et porte deux bugs : « Contribuer » perd des sommes, et un compte partagé en lecture seule ne peut pas lire les objectifs (`docs/savings.md`, règles « Contribuer » et « Accès base (RLS) »). On la retire entièrement.

## Critères d'acceptation
- [ ] CA1 — Étant donné un utilisateur connecté, quand il appelle `GET`, `POST`, `PATCH` ou `DELETE` sur `/:accountId/savings-goals…`, alors la route n'existe plus (404).
- [ ] CA2 — Étant donné la liste, le détail ou l'export d'une transaction, quand on lit la réponse, alors elle ne contient plus `savingsGoalId`.
- [ ] CA3 — Étant donné un client qui envoie encore `savingsGoalId` en créant ou modifiant une transaction, alors la demande est refusée en 400 comme tout champ inconnu (décision de Lucas), et rien n'est écrit.
- [ ] CA4 — Étant donné l'application, quand l'utilisateur ouvre `/savings`, alors la page n'existe plus (404) ; le menu latéral n'a plus l'entrée « Épargne » et le titre d'en-tête associé disparaît.
- [ ] CA5 — Étant donné un tableau de bord dont la disposition enregistrée contient le widget `savings`, quand il s'affiche ou s'édite, alors il s'affiche sans erreur, sans ce widget, avec les autres widgets inchangés (ordre, largeur, visibilité) ; le widget n'est plus proposé dans le catalogue.
- [ ] CA6 — Étant donné le formulaire de transaction (création, édition, « ajouter une autre »), alors il n'a plus de champ « objectif » et n'appelle plus l'API des objectifs.
- [ ] CA7 — Étant donné un compte, quand on crée une transaction, un virement, un import en lot, une période avec transactions récurrentes, ou qu'on modifie/remplace une transaction, alors chacune de ces opérations réussit et reste atomique (tout ou rien) comme avant.
- [ ] CA8 — Étant donné une base qui contient des objectifs et des transactions liées à un objectif, quand on applique la migration, alors elle passe sans erreur, la table `savings_goals`, la colonne `transactions.savings_goal_id` et le trigger `sync_savings_goal_amount` n'existent plus, et toutes les transactions sont conservées (même nombre, mêmes montants, dates, catégories, tags, période).

## Règle critique
Aucune transaction n'est perdue ni modifiée par la migration, et les écritures atomiques (création, virement, import, période, enregistrement) fonctionnent encore une fois la colonne retirée. Test avant le code : une base avec objectif + transactions liées, migration appliquée, comptage et contenu des transactions identiques, puis chaque écriture de CA7 réussit.

## Mesure d'impact
- Indicateur qui doit bouger : lignes et fichiers de code en moins ; 2 bugs connus qui disparaissent (« Contribuer » perd des sommes ; lecture refusée aux partages en lecture seule).
- Équipe qui en profite : Performance (moins de code à maintenir).
- Comment on le mesure : `git diff --stat` du cycle (fichiers et lignes retirés) ; pas de log à ajouter.

## Exploitation
- À voir en prod : aucune erreur 500 sur les écritures de transactions (création, virement, import, période) après la mise en ligne ; logs de l'API existants suffisent.
- Retour arrière : revert du code possible, mais les données `savings_goals` et les liens `savings_goal_id` sont perdus pour de bon : sauvegarde de la base avant d'appliquer la migration.
- Ordre de mise en ligne : l'API (qui n'écrit ni ne lit plus la colonne) avant la migration ; sinon un ancien code qui lit/écrit `savings_goal_id` échoue entre les deux. Lancé par Lucas.
- Feature flag : non (retrait pur, personne ne l'utilise).

## Parties sensibles
- Redéfinition des fonctions SQL atomiques des transactions (`insert_transactions`, qui sert aussi `create_transfer`, `create_transactions` et `create_period_with_budgets` ; `upsert_transactions`, qui sert `save_transaction`) — cohérence des données / transaction. Un oubli casse toutes les écritures de transactions.
- Suppression irréversible de la table, de la colonne et du trigger, dans la même migration. Hors critères stricts du skill, mais regroupée avec le point précédent car elle ne se rattrape pas.

## Ce qui change dans l'existant
- Supprime `docs/savings.md` (module entier) : toutes ses règles disparaissent.
- Change `docs/transactions.md` : le vocabulaire « Objectif d'épargne », la règle « catégorie, tags et objectif d'épargne doivent appartenir au compte → 400 » (devient catégorie et tags seulement ; `AccountReferencesService` n'a plus `ensureSavingsGoal`), les règles en base lignes 43-44 (trigger, `ON DELETE SET NULL`), et les mentions lignes 26-27, 30, 50, 78.
- Change `docs/preferences.md` : le catalogue passe de 15 à 14 widgets ; la règle « un id inconnu est ignoré » (ligne 24) s'applique au widget `savings`.
- `docs/smart-rules.md` : aucune règle touchée (la table des règles intelligentes est conservée, seule la migration commune `20260316000002` les contient).
- La catégorie de type `savings` (`docs/categories.md:9`) est un autre concept : elle reste.

## Fichiers concernés
Back
- À supprimer : `functions/src/savings-goals/` (module, contrôleur, cas d'usage, entité, dépôt, 2 specs)
- À modifier : `functions/src/app.module.ts:18,37` ; `functions/src/shared/account-references.module.ts:4,12` ; `functions/src/shared/application/account-references.service.ts:4,11,29-30,62-67,92` (retrait de l'objectif)
- À modifier : `functions/src/transactions/infrastructure/transactions.controller.ts:137-143,267,520,634` ; `transaction-payload.ts:22` ; `supabase-transaction.repository.ts:30,329` ; `functions/src/transactions/domain/transaction.entity.ts:17,36,54,82-96` ; `application/create-transaction.use-case.ts:19,45`
- Tests à modifier : `create-transaction.use-case.spec.ts:62,73` ; `supabase-transaction.repository.spec.ts:43` ; `functions/test/account-ownership.e2e-spec.ts` (59, 165-178) ; `auth.e2e-spec.ts:40` ; `cross-account-references.e2e-spec.ts` (47, 67, 229, 337-345) ; `validation.e2e-spec.ts` (78-81, 255-271, 296, 436-454, 570, 590, 660, 973-993) ; `e2e-app.ts:61`
- À ajouter dans un test existant : CA3 (400 sur `savingsGoalId`) dans `validation.e2e-spec.ts`

Base (le projet gère le schéma par fichiers dans `supabase/migrations/`, pas de `synchronize`)
- À créer : `supabase/migrations/20261101100100_remove_savings_goals.sql` — redéfinit `insert_transactions` et `upsert_transactions` sans la colonne, puis supprime le trigger/la fonction `sync_savings_goal_amount`, la colonne `transactions.savings_goal_id` (et son index), la table `savings_goals`. Les anciennes migrations ne sont pas modifiées (`20260316000002`, `20260318131922`, `20260318143724`, `20261030100000`, `…100100`, `…100300`, `…100400`). Le nom du fichier n'est pas existant (Glob vérifié).
- Test de la migration : base avec objectif + transactions liées (CA8) ; à défaut de banc existant, vérification manuelle dans `http/suppression-epargne.http` (à créer, la base locale a 0 donnée liée : insérer les lignes de test à la main)

Front
- À supprimer : `frontend/src/app/[locale]/(dashboard)/savings/page.tsx` ; `frontend/src/features/savings/` (api, model, ui dont `savings-goals-list.test.tsx`)
- À modifier : `frontend/src/features/preferences/config/dashboard-widgets.tsx:15,41,64` ; `frontend/src/features/transactions/ui/transaction-form.tsx:15,27,52,62,99,172-187` ; `transactions/model/types.ts:15` ; `frontend/src/shared/api/mutation-error.ts:42` ; `shared/ui/layout/sidebar.tsx:37` ; `shared/ui/layout/header-title.ts:12`
- Messages à modifier : `frontend/messages/fr.json` (16, 68, 86, 487-…, 619) et `en.json` (mêmes clés + 283) — ne pas toucher à la clé de la catégorie de type épargne (ligne 365 : à vérifier avant de retirer)
- Tests à modifier : `header-title.test.ts:24,29` ; `transaction-form.test.tsx:10` ; `transaction-form.add-another.test.tsx:49-50` ; test de non-régression du tableau de bord avec `savings` enregistré (`visible-layout.test.ts` existant, y ajouter un cas)
- À modifier : `http/montants-centimes-entiers.http:146` (appel à `/savings-goals` à retirer)

## Hors périmètre
- Aucune conversion ou sauvegarde des objectifs existants (Lucas : suppression sans condition).
- Pas de nettoyage des dispositions de tableau de bord déjà enregistrées en base : l'id `savings` y reste, ignoré à l'affichage.
- La catégorie de type `savings` et les transactions d'épargne ordinaires restent.

## Hypothèses
- CA3 : un `savingsGoalId` reçu est refusé en 400 comme tout champ inconnu (`functions/src/shared/infrastructure/route-id.pipe.ts:36`, `forbidNonWhitelisted: true`). Confirmé par Lucas (2026-11-01).
- CA1 : « 404 » est la réponse de Nest à une route absente ; pour un jeton absent, l'ordre garde/route n'est pas un enjeu (plus de route).
- La migration n'a besoin d'aucune protection pour les lignes liées : la suppression de la colonne emporte le lien, les transactions restent.
- Les autres écritures vers `transactions` (récurrentes, règles intelligentes, rapports) n'utilisent pas `savings_goal_id` : seuls les fichiers listés le référencent (grep `savings_goal` sur `supabase/` et `functions/src`).

## Points ouverts
- Aucun : CA3 tranché par Lucas (400, comme tout champ inconnu ; un onglet resté sur l'ancien front doit être rechargé).
