# Besoin — playwright-recette

Installer Playwright dans le front (frontend/) pour vérifier en réel les parcours de l'application sur la recette, avec un compte de test dédié créé dans la base Supabase de recette, et committer les fichiers de tests.

Contexte (Lucas, 2026-11-22) : « Tu peux te créer un compte dans la base de recette supabase. Installe playwright et commit les fichiers de tests. »

## Réponses de Lucas
- Cible : les deux. Recette déployée (https://account-recette.web.app) par défaut, URL locale possible par configuration.
- Données : chaque test crée ce dont il a besoin avec le compte de test, puis le supprime. Rien ne s'accumule.
- Commits : sur `main`. `main` a été avancé sans fusion jusqu'à 607f1ca (les 3 quickfix du 2026-11-22), et ce worktree est passé sur `main`. Aucun push.
- Impact : part des critères front marqués « livré ✅ » après une vérification Playwright plutôt que « tests seulement », lue dans le récapitulatif de livraison.
- Compte de test : Claude le crée lui-même dans la base Supabase de recette (autorisation de Lucas). Jamais en prod.
