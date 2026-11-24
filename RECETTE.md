# Environnement de recette — account-v2

Recette = code de `main` déployé sur des projets Firebase et Supabase **séparés de la prod**.
Ce dossier est un `git worktree` du dépôt `~/Projects/perso/account-v2` : on déploie la recette depuis ici, jamais depuis le dépôt principal.

## Repères

| | Recette | Prod (ne pas toucher) |
| --- | --- | --- |
| Front | https://account-recette.web.app | — |
| API | https://europe-west1-account-recette.cloudfunctions.net/api | projet de prod |
| Projet Firebase | `account-recette` | projet de prod |
| Projet Supabase | `zcoteefoqzyoqpzeqzql` (account-recette, Paris) | lié à la CLI |

Secrets : jamais dans un fichier suivi par git. Leur emplacement et la valeur de `RECETTE_DB_URL` (lue dans le trousseau) sont dans `RECETTE.local.md`, non suivi.

Fichiers propres à la recette, non suivis par git (ne pas les committer) :
- `firebase.recette.json` : copie de `firebase.json`, la redirection pointe vers `ssraccountrecette` au lieu de celle de la prod
- `functions/.env` : `SUPABASE_URL` + `SUPABASE_ANON_KEY` de recette (pas de `SUPABASE_JWT_SECRET` : le back valide les jetons ES256 par JWKS)
- `frontend/.env.production` : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` de recette

## Règles de sécurité

- Toujours `--config firebase.recette.json --project account-recette` sur `firebase deploy`. Sans ça, on déploie en prod.
- Côté Supabase, toujours `--db-url` vers la recette. **Jamais** `supabase link`, `--linked` ni `supabase db reset` sans `--db-url` : la CLI est liée à la prod.

## Prérequis

- `firebase --version` ≥ 15.37.0 (la 15.5.1 ne reconnaît pas ce front Next). Mise à jour : `npm i -g --prefix /usr/local firebase-tools@latest`
- Connecté : `firebase login --reauth` si erreur 401
- `supabase`, `psql` installés

## Utiliser la recette pour une évolution

1. **Base réveillée ?** Voir « Relancer la base en pause ». À faire en premier : sans base, tout le reste échoue.
2. Développer, puis vérification complète : `tsc`, lint, tests et build du front et du back, e2e du back (`cd functions && npx jest --config ./test/jest-e2e.json`).
3. Pousser `main`. Un push ne déploie rien : seul un tag `v*` déploie la prod. **Ne jamais pousser de tag depuis ce dossier.**
4. Déployer en recette (section suivante) : migrations s'il y en a, puis front et back, puis contrôles.
5. Vérifier en réel :
   - parcours : `cd frontend && npm run e2e` (compte de test, voir `specs/playwright-recette/procedure.md`). Supprime tous ses comptes bancaires `e2e-*`, démo comprise ;
   - scénarios `http/*.http` : contre l'API déployée, jouer une copie hors dépôt avec `@baseUrl = https://europe-west1-account-recette.cloudfunctions.net/api`, et à côté un `.httpyac.json` contenant `{"cookieJarEnabled": false}` (sinon « Cookie has domain set to a public suffix »). Les fichiers qui font un signup échouent vite en recette (`over_email_send_rate_limit`) : les jouer sur Supabase local ;
   - une assertion `??` sans opérateur (`==`, `contains`…) est ignorée en silence par httpYac.
6. Nettoyer : ne laisser aucun compte jetable `e2e-*`.

## Relancer la base en pause

Un projet Supabase gratuit est mis en pause après une faible activité sur 7 jours, avec un e-mail d'avertissement avant ; il est restaurable pendant 1 an (https://supabase.com/docs/guides/platform/free-project-pausing). Données et configuration reviennent telles quelles.

Symptômes : connexion impossible sur le front, API qui répond en erreur, `psql` qui ne se connecte pas.

1. **État** (lecture seule) :

```sh
supabase projects list -o json | python3 -c 'import sys,json;[print(p["name"],p["status"]) for p in json.load(sys.stdin) if p["id"]=="zcoteefoqzyoqpzeqzql"]'
```

   `ACTIVE_HEALTHY` : rien à faire. `INACTIVE` : en pause, passer au 2. `RESTORING` ou `COMING_UP` : attendre.

2. **Relancer**, au choix (jamais le projet de prod) :
   - tableau de bord : https://supabase.com/dashboard/project/zcoteefoqzyoqpzeqzql puis « Resume project » ;
   - API de gestion, avec un jeton personnel (droit `projects:write`) saisi dans le terminal, jamais écrit dans un fichier :

```sh
read -rs SUPABASE_PAT
curl -sS -X POST -H "Authorization: Bearer $SUPABASE_PAT" -w '\n%{http_code}\n' https://api.supabase.com/v1/projects/zcoteefoqzyoqpzeqzql/restore
unset SUPABASE_PAT
```

3. **Attendre** : relancer la commande d'état jusqu'à `ACTIVE_HEALTHY`.

4. **Contrôler** la base, les clés et les migrations :

```sh
PGOPTIONS='-c default_transaction_read_only=on' psql "$RECETTE_DB_URL" -At -c "select count(*) from public.transactions" -c "select max(version) from supabase_migrations.schema_migrations"
ls supabase/migrations | tail -1
curl -s -o /dev/null -w '%{http_code}\n' https://europe-west1-account-recette.cloudfunctions.net/api/accounts   # 401 sans jeton
```

   Puis se connecter sur le front. Si la connexion échoue avec une base saine, comparer les clés (`supabase projects api-keys --project-ref zcoteefoqzyoqpzeqzql`) avec `functions/.env` et `frontend/.env.production` : la doc ne dit pas si elles changent. Si elles diffèrent, mettre à jour les deux fichiers, `frontend/.env.e2e` (`npm run e2e:create-user`), et redéployer.

5. **Après plus d'un an** (non restaurable) : créer un projet, remplacer l'identifiant `zcoteefoqzyoqpzeqzql` partout (`grep -rn zcoteefoqzyoqpzeqzql` : ce fichier, les `.env`, le garde-fou e2e), puis « Remettre la base de recette à l'état initial ».

Essayé le 2026-11-24 : la commande d'état et les contrôles. **Non essayé** : la relance (la base était active).

## Déployer `main` en recette

### 1. Mettre le worktree sur le dernier `main`

```sh
cd ~/Projects/perso/account-v2-recette
git status --short            # attendu : seulement firebase.recette.json
git fetch origin main
git checkout --detach origin/main
git log -1 --oneline
(cd frontend && npm ci --legacy-peer-deps)
(cd functions && npm ci)
```

`firebase deploy` part des fichiers du dossier, pas du dernier commit : ne jamais déployer avec du code non committé.
Une branche n'est ouverte que dans un seul worktree à la fois. Si le dépôt principal doit passer sur `main`, laisser ce dossier détaché.

### 2. Migrations Supabase

À faire avant le back si une migration change une signature de fonction (lire l'en-tête « ordre de déploiement » des nouvelles migrations).

```sh
supabase db push --db-url "$RECETTE_DB_URL"
```

### 3. Front et back

```sh
firebase deploy --config firebase.recette.json --project account-recette --force
```

Le rendu serveur Next part en `us-central1` (défaut Firebase), l'API en `europe-west1`.

### 4. Vérifier

```sh
curl -sL -o /dev/null -w '%{http_code}\n' https://account-recette.web.app/                                  # 200 (redirige vers /login)
curl -s  -o /dev/null -w '%{http_code}\n' https://europe-west1-account-recette.cloudfunctions.net/api/api-json  # 200
curl -s  -o /dev/null -w '%{http_code}\n' https://europe-west1-account-recette.cloudfunctions.net/api/accounts  # 401 sans jeton
```

Puis se connecter sur https://account-recette.web.app.

## Remettre la base de recette à l'état initial

Procédure dans `RECETTE.local.md` (non suivi par git).

## Pièges connus

- **Chemin avec un UUID** : npm masque les UUID dans `npm root` (`***`), Firebase ne trouve plus `next` (« Could not find the next executable »). Garder ce worktree dans un chemin sans UUID.
- **Claude Code** : le hook `deploy-guard` refuse `supabase db push` lancé avec `cd`, `-C` ou `--workdir` hors du dépôt principal. Le `db push` de recette (étape 2) est donc lancé par Lucas.
- **`firebase deploy` renvoie 0 même en échec** de détection du framework : lire la sortie, chercher « Deploy complete! ».
- **Avertissements sans conséquence** : convention `middleware` dépréciée (Next), `firebase-functions` ancien (mise à jour cassante, non faite).

## Supprimer la recette

```sh
firebase projects:delete account-recette
supabase projects delete zcoteefoqzyoqpzeqzql
cd ~/Projects/perso/account-v2 && git worktree remove --force ../account-v2-recette
```
