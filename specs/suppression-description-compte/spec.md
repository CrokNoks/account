# Suppression de la description du compte

## Le problème
Le champ « Objectif / Pitch » d'un compte ne servait qu'à donner du contexte à l'analyse IA, supprimée avec Gemini. Il reste dans l'écran, l'API et la base : du code et des données inutiles, et un champ qui promet une aide IA qui n'existe plus.

## Critères d'acceptation
- [ ] CA1 — Étant donné le formulaire de création ou de modification d'un compte, quand je l'ouvre, alors seuls le nom et le solde initial sont demandés (plus de champ « Objectif / Pitch », ni libellé, aide ou exemple en fr et en).
- [ ] CA2 — Étant donné un ancien écran en cache qui envoie encore `description` à la création, quand il valide, alors le compte est créé normalement et la description n'est pas conservée.
- [ ] CA3 — Étant donné un ancien écran en cache qui envoie `description` en modifiant un compte, quand le propriétaire valide, alors les autres champs fournis sont modifiés et la description est ignorée.
- [ ] CA4 — Étant donné la création, la modification ou la liste des comptes, quand l'API répond, alors aucun compte ne contient `description`.
- [ ] CA5 — Étant donné un champ inconnu autre que `description` (ex. `type`, `currency`) sur les routes comptes, quand il est envoyé, alors la requête reste refusée (400) comme aujourd'hui ; les autres routes de l'API gardent leur comportement.
- [ ] CA6 — Étant donné un utilisateur qui modifie un compte dont il n'est pas propriétaire (avec ou sans `description`), quand il envoie le PATCH, alors il reçoit toujours 403 s'il a accès au compte (partage) et 404 s'il n'y a aucun accès (le compte lui est invisible), et rien n'est écrit.
- [ ] CA7 — Étant donné la base après migration, quand on consulte `accounts`, alors la colonne `description` n'existe plus ; les autres colonnes et les règles d'accès (propriétaire / partage) sont inchangées, et le seed et les migrations rejouées de zéro passent.
- [ ] CA9 — Étant donné la visite guidée (étape libellé d'une transaction, `tour.transactions.description` fr/en), quand elle s'affiche, alors elle ne mentionne plus d'IA (« Notre IA… » / « Our AI… ») ; si une suggestion de catégorie existe sans IA (règles intelligentes), le texte le dit sans parler d'IA, sinon la phrase est retirée.
- [ ] CA8 — Étant donné le code du projet, quand on cherche la description du compte (back, front, traductions, tests), alors il n'en reste aucune occurrence.

## Règle critique
Un ancien client qui envoie `description` à la création ou au PATCH d'un compte obtient une réponse de succès (pas de 400) ; la valeur n'est ni stockée ni renvoyée. Test écrit avant le code (CA2, CA3, CA4), au niveau e2e, avec les pipes globaux réels.

## Mesure d'impact
- Indicateur qui doit bouger : occurrences de la description du compte dans le code et colonnes en base (de « plusieurs fichiers + 1 colonne » à 0).
- Équipe qui en profite : Performance (moins de code et de données à maintenir, écran cohérent).
- Comment on le mesure : `grep` du code (CA8) et requête sur le schéma (colonne absente de `information_schema.columns`) après migration. Pas de métrique produit.

## Exploitation
- Ce qu'on doit pouvoir voir en prod : pas de hausse de 400 ni de 500 sur `POST /accounts` et `PATCH /accounts/:id` après déploiement.
- Ordre de déploiement : back (qui n'écrit plus `description`) AVANT la migration. Si la migration passe en premier, l'ancien back écrit encore `description` (`supabase-account.repository.ts:31`, PATCH) : création et modification de compte en erreur (500) jusqu'au déploiement du back. Les lectures `select('*')` ne casseraient pas.
- Retour arrière : revert du code possible ; la colonne supprimée ne revient qu'à vide (données perdues, acceptées par Lucas).
- Feature flag : non.

## Parties sensibles
Aucune. (La suppression de données est définitive mais acceptée par Lucas ; elle n'entre pas dans les critères du point de contrôle.)

## Ce qui change dans l'existant
Change dans `docs/accounts.md` :
- la règle « description optionnelle » (compte : nom obligatoire, solde initial) ;
- la règle « Modifier un compte » (plus de description ; une `description` envoyée est ignorée) ;
- « Ce qu'on stocke » (colonne retirée) ;
- les zones d'ombre sur le formulaire « Objectif / Pitch », sur `dto.description ?? existant` et sur le 400 des champs inconnus (désormais `description` fait exception sur les routes comptes).

Chemins exposant le compte, tous couverts : création (CA4), liste (CA4), modification (CA3/CA4). Les routes de partage (`/accounts/:id/shares`) ne renvoient pas le compte.

## Fichiers concernés
Vérifiés par Grep.
- À créer : nouvelle migration `supabase/migrations/2026…_drop_description_from_accounts.sql` — `DROP COLUMN description` (le projet utilise des migrations Supabase, nom horodaté après `20261030100500`). Vérifié : aucune fonction, vue, policy ou RPC SQL ne lit `accounts.description` (`remote_schema.sql:43,55`, `schema_complete.sql:145,192,199` n'utilisent que `id`/`owner_id`) ; `seed.sql` ne l'insère pas (ses `description` visent catégories et transactions).
- À modifier (back) : `functions/src/accounts/domain/account.entity.ts` ; `functions/src/accounts/application/create-account.use-case.ts` ; `functions/src/accounts/infrastructure/accounts.controller.ts` (DTO création et modification, PATCH l.162/175, réponses l.209/219/237) ; `functions/src/accounts/infrastructure/supabase-account.repository.ts` (l.11,31,77). Le comportement « ignorer `description` » doit rester limité aux routes comptes (`functions/src/shared/infrastructure/route-id.pipe.ts:32-38` est global).
- À modifier (front) : `frontend/src/features/accounts/model/types.ts` ; `ui/account-form.tsx` ; `ui/create-account-dialog.tsx` ; `ui/account-list.tsx` ; `api/use-create-account.ts` ; `api/use-update-account.ts` ; `frontend/messages/fr.json` et `en.json` (l.215-216, 218 : `description`, `description_hint`, `description_placeholder`).
- Tests à modifier : `functions/test/front-contract.e2e-spec.ts:64-68` (devient le test de la règle critique : `description` acceptée et ignorée) ; `functions/test/account-ownership.e2e-spec.ts:41,109,361` (le PATCH du test 403 passe à un autre champ, ex. `name`) ; `functions/src/accounts/domain/account.entity.spec.ts` et `application/create-account.use-case.spec.ts` si ils référencent la description ; `frontend/src/features/accounts/ui/account-list.test.tsx:8-9` ; `ui/create-account-dialog.test.tsx:35`.
- Doc : `docs/accounts.md` (mise à jour par le documentaliste après livraison).

## Hors périmètre
- Sauvegarde ou export des descriptions existantes (perte acceptée).
- Autres textes « IA » du front (ex. suggestion de catégorie dans `fr.json:560`).
- Route de suppression de compte, autres champs du compte.

## Hypothèses
- L'ignorance silencieuse de `description` ne vaut que pour les routes de création et de modification de compte ; les autres routes gardent `forbidNonWhitelisted` (non dit par Lucas, déduit de « création ou modification d'un compte »).
- La réponse d'un ancien client ne contient plus `description` ; un ancien front qui l'afficherait montrerait un champ vide, sans erreur.
- Aucun consommateur externe (autre que le front du dépôt) ne lit `description` : non vérifiable dans le code.

## Points ouverts
- Aucun bloquant. À confirmer par Lucas : l'ordre back puis migration (voir Exploitation) ; une sauvegarde de la colonne avant `DROP` reste possible mais n'est pas demandée.

## Décisions de Lucas (validation)
- Ordre de déploiement : back puis migration.
- `description` ignorée uniquement sur la création et la modification de compte ; les autres champs inconnus restent en 400.
- PATCH qui n'envoie que `description` : succès, compte inchangé.
- Mention « IA » de la visite guidée retirée (CA9).
