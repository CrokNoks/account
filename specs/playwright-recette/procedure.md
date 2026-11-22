# Parcours Playwright sur la recette : mode d'emploi

Tout se lance depuis `frontend/`. Les tests ne visent que la recette (`https://account-recette.web.app`) ou un front local branché sur la recette. Toute autre cible (prod comprise) est refusée avant la moindre connexion (`e2e/lib/target-guard.ts`).

## 1. Créer le compte de test (une fois, relançable)

```sh
npm run e2e:create-user
```

- Ne vise que le projet Supabase de recette (`zcoteefoqzyoqpzeqzql`, codé en dur et vérifié par le garde-fou).
- Lit la clé de service de recette via la CLI Supabase (`supabase projects api-keys --project-ref zcoteefoqzyoqpzeqzql`, jamais `--linked`), le temps de la commande : elle n'est écrite nulle part. La CLI utilise le jeton du trousseau macOS : lancer la commande hors bac à sable si besoin. Sinon, passer `E2E_SERVICE_ROLE_KEY` et `E2E_SUPABASE_ANON_KEY` en variables d'environnement.
- Crée l'utilisateur `e2e-playwright@example.com` avec e-mail confirmé, ou remet à jour son mot de passe s'il existe : aucun doublon.
- Écrit les identifiants dans `frontend/.env.e2e` (ignoré par git, droits 600). À relancer après chaque remise à zéro de la recette (`RECETTE.md`).

## 2. Lancer les parcours

```sh
npm run e2e                                   # contre la recette
E2E_BASE_URL=http://localhost:3000 npm run e2e # contre un front local (ex. `npm run dev`), à condition qu'il parle à la recette
```

`npm test` (vitest) ne lance que les tests de `src/` et le test unitaire du garde-fou (`e2e/**/*.test.ts`) ; `npm run e2e` ne lance que `e2e/**/*.spec.ts`.

Rapports et traces (`frontend/playwright-report`, `frontend/test-results`) sont ignorés par git.

## 3. Données et nettoyage

- Tout ce que les parcours créent porte le préfixe `e2e-`.
- Après chaque test (réussi ou non), au démarrage et à la fin de la suite, les comptes bancaires `e2e-*` du compte de test sont supprimés (leurs transactions partent en cascade). Un passage tué en cours de route est donc rattrapé au démarrage suivant. Rien d'autre n'est supprimé.
- Les comptes bancaires n'ont pas de suppression dans l'UI : le nettoyage passe par la session du compte de test, hors de l'interface.

## 4. Retour arrière

`git revert` du commit ; supprimer l'utilisateur `e2e-playwright@example.com` dans Authentication de la recette si besoin.
