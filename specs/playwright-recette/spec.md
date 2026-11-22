# Vérification en réel de l'application avec Playwright (recette)

## Le problème
Les critères front ne sont « livrés ✅ » que s'ils ont été vus fonctionner en réel. Aujourd'hui cette vérification est manuelle : beaucoup de critères restent « tests seulement » (ex. `docs/transactions.md`, zones d'ombre : « jamais vu en réel »). On veut des parcours automatisés, rejouables sur la recette, sans jamais toucher la prod ni laisser de données.

## Critères d'acceptation
- [ ] CA1 — Étant donné le dossier `frontend/`, quand je lance la commande npm dédiée aux tests Playwright, alors les parcours s'exécutent dans un vrai navigateur ; `npm test` (vitest) continue de ne lancer que ses propres tests et ne ramasse aucun fichier Playwright, et la commande Playwright ne ramasse aucun test vitest.
- [ ] CA2 — Étant donné aucune configuration, quand je lance les tests, alors ils visent la recette déployée (https://account-recette.web.app) ; étant donné une URL locale renseignée (ex. `next dev`), alors ils visent cette URL.
- [ ] CA3 — Étant donné la commande documentée de création du compte de test, quand je la lance (une ou plusieurs fois), alors un compte de test existe dans l'Auth Supabase de la recette (`zcoteefoqzyoqpzeqzql`) et nulle part ailleurs ; relancée, elle ne casse rien et ne crée pas de doublon. Les identifiants du compte ne figurent dans aucun fichier suivi par git : ils viennent de variables d'environnement ou d'un fichier ignoré par git.
- [ ] CA4 — Étant donné le compte de test, quand le parcours de connexion s'exécute, alors l'utilisateur arrive sur l'accueil connecté (`/`) ; sans session, une page protégée renvoie sur `/login` (règles de `docs/auth.md`).
- [ ] CA5 — Étant donné un utilisateur connecté avec le compte de test, quand le parcours « données » s'exécute, alors il crée un compte bancaire puis une transaction sur ce compte, les voit à l'écran (nom du compte, libellé, montant), puis les supprime.
- [ ] CA6 — Étant donné un parcours qui échoue ou est interrompu en cours de route, quand il se termine, alors le compte bancaire et les transactions qu'il avait créés n'existent plus (vérifié sur la base de recette, via l'API ou Supabase avec la session du compte de test). Le nettoyage ne supprime que ce que le test a créé, jamais les autres données de la recette.
- [ ] CA7 — Étant donné une URL cible ou un projet Supabase qui n'est pas la recette (ou localhost) — notamment la prod (`account-c6a3f`, `qemrhlovsmnhoxlkhzmv`) —, quand je lance les tests, alors ils refusent de démarrer avec un message clair, avant toute connexion ou création de données. Même refus si, en local, le front visé parle à un Supabase autre que la recette.
- [ ] CA8 — Étant donné le dépôt après le commit, quand je liste les fichiers suivis, alors on y trouve la configuration et les tests Playwright, mais ni identifiants du compte de test, ni rapports, ni traces de passage (ils sont ignorés par git).

## Règle critique
Les tests ne s'exécutent jamais contre la prod (CA7) : la cible est acceptée par liste blanche (recette ou localhost, projet Supabase de recette), pas par liste noire. Test écrit avant le code : une cible prod (URL du front de prod, URL Supabase de prod) et une cible inconnue sont refusées ; la recette et localhost sont acceptées.

## Mesure d'impact
- Indicateur qui doit bouger : part des critères front marqués « livré ✅ » après une vérification Playwright plutôt que « tests seulement ».
- Comment on le mesure : lue dans le récapitulatif de livraison de chaque cycle (réponse de Lucas). Point de départ : 0 parcours Playwright ; après ce cycle : 2 (connexion, création/suppression de données).

## Exploitation
- Rien à surveiller en prod : aucun code applicatif n'est modifié.
- Ce qu'on doit voir côté recette : après un passage, aucun compte bancaire ni transaction du compte de test (CA6).
- Retour arrière : `git revert` du commit ; supprimer l'utilisateur de test dans l'Auth de la recette si on le veut.
- Feature flag : non. Pas de CI ajoutée (non demandée).

## Parties sensibles
Aucune au sens du point de contrôle (pas de calcul d'argent, pas d'algorithme, pas de concurrence, pas de brique d'architecture applicative). Vigilance, à traiter en critères CA3/CA6/CA7 plutôt qu'en point de contrôle : la recette contient une copie des données bancaires réelles de la prod (`RECETTE.md`), et la création du compte de test demande un droit d'administration sur la recette.

## Ce qui change dans l'existant
Ne change aucune règle de `docs/`. S'appuie sur : `docs/auth.md` (connexion e-mail + mot de passe ; redirections `/login` et `/`), `docs/accounts.md` (création de compte : nom obligatoire, solde initial par défaut 0 ; l'UI du front n'a pas de suppression de compte), `docs/transactions.md` (création et suppression d'une transaction, montants en centimes).

Chemins d'exposition : cette fonctionnalité n'ajoute aucune règle de visibilité ; le compte de test ne voit que ses propres données (RLS, `docs/accounts.md`).

## Fichiers concernés
Vérifiés par Glob/Grep. Le projet gère le schéma par migrations Supabase, mais aucune n'est nécessaire ici.
- Modifier : `frontend/package.json` (dépendance de test et script npm Playwright) et `frontend/package-lock.json`.
- Modifier : `frontend/vitest.config.mts` seulement si l'`include` actuel (`src/**/*.test.{ts,tsx}`) ne suffit pas à exclure les fichiers Playwright (selon l'emplacement et le nom choisis pour ceux-ci).
- Modifier : `.gitignore` (racine ; contient déjà `frontend/test-results`) pour le rapport et les traces ; `frontend/.gitignore` ignore déjà `.env*` (utilisable pour les identifiants du compte de test).
- Créer : configuration Playwright (`frontend/playwright.config.ts`, absente), tests et garde-fou de cible (dossier hors `src/`, ex. `frontend/e2e/`, absent), commande ou script de création du compte de test.
- Créer : une courte section de procédure dans `specs/playwright-recette/` ou dans `RECETTE.md` (non suivi par git, donc de préférence un fichier suivi) : lancer les tests, créer le compte de test.
- Tests : le garde-fou de cible (CA7) a son propre test, écrit avant le code.
- Doc : aucune mise à jour de `docs/{module}.md` (pas de règle métier changée).

## Hors périmètre
- CI, exécution planifiée, autres navigateurs/mobiles, tests de la prod.
- Parcours au-delà de la connexion et de la création/suppression d'un compte et d'une transaction.
- Ajout d'une route ou d'un bouton de suppression de compte dans l'application (`docs/accounts.md` : « pas de route pour supprimer un compte »).
- Remise de la base de recette à l'état de la prod (procédure de `RECETTE.md`).

## Hypothèses
- Aucune inscription dans le front (`docs/auth.md`, zones d'ombre) : le compte de test se crée côté Supabase de la recette avec un droit d'administration (jeton CLI du trousseau ou clé de service de recette). Le choix de la méthode revient au développeur ; le secret n'est jamais écrit dans un fichier suivi.
- Lucas a autorisé Claude à créer ce compte dans la base de recette (`besoin.md`), jamais en prod.
- L'application n'expose pas de suppression de compte bancaire (ni UI ni API) ; la base l'autorise au propriétaire (`docs/accounts.md:29,55`) et la suppression du compte supprime en cascade ses transactions (`supabase/migrations/20251221_schema_complete.sql:117,130`). La suppression du compte bancaire par le test (et le nettoyage en cas d'échec) passe donc par la session du compte de test hors de l'UI ; la suppression d'une transaction peut, elle, passer par l'application.
- Le compte de test est un nouvel utilisateur : sans données initiales, sans accès aux comptes des autres (RLS). Le trigger `sync_app_users` le copie dans `app_users` à la création (`docs/auth.md`).
- Les parcours doivent fonctionner sans période préexistante pour le compte de test ; si l'écran exige une période pour afficher la transaction, c'est à ajuster dans le parcours (non vérifié dans le code).
- La liste blanche des cibles est : `https://account-recette.web.app`, `localhost`/`127.0.0.1`, et le projet Supabase `zcoteefoqzyoqpzeqzql`. L'URL du front de prod n'est pas dans le dépôt ; la liste blanche rend ce point sans importance.
- `frontend/CLAUDE.md` prévient que cette version de Next diffère de l'habituel : le développeur lit `node_modules/next/dist/docs/` avant d'ajouter une configuration de serveur local.

## Points ouverts
- Aucun bloquant. Si le compte de test doit survivre à un « remettre la recette à l'état de la prod » (`RECETTE.md`, `db reset`), il faut relancer la commande de création après chaque remise à zéro : la commande de CA3 est idempotente pour cela.
