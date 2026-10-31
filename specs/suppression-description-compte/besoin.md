# Besoin

Suite à la suppression de Gemini (cycle suppression-gemini) : le champ `description` du compte (« Objectif / Pitch »), qui servait uniquement de contexte à l'analyse IA, ne sert plus. Le supprimer du front, du back et de la base (colonne `accounts.description` supprimée par migration) — option 2 choisie par Lucas, perte définitive des descriptions déjà saisies acceptée.

## Réponses de Lucas

- Ancien front en cache qui envoie encore `description` à la création ou à la modification d'un compte : la description est ignorée silencieusement (pas de 400, la requête aboutit).
- Impact attendu : retirer un champ qui ne sert plus (cohérence de l'écran, moins de code et de données inutiles).
- Mode : complet confirmé (suppression définitive de données, règles de `docs/accounts.md` modifiées).
