# Besoin — suppression-epargne

Supprimer la fonctionnalité « objectifs d'épargne » (savings goals) : page /savings, widget tableau de bord, routes API /:accountId/savings-goals, champ « objectif » (savingsGoalId) des transactions, table savings_goals, colonne transactions.savings_goal_id et trigger sync_savings_goal_amount. Personne ne l'utilise (0 objectif, 0 transaction liée en base locale) et elle porte deux bugs (Contribuer perd des sommes, lecture refusée en lecture seule).

## Réponses de Lucas

- Données en prod : supprimer sans condition (table `savings_goals` et lien `transactions.savings_goal_id`, quelles que soient les données). Les transactions elles-mêmes sont conservées.
- Impact attendu : moins de code à maintenir — mesuré par les fichiers et lignes retirés (`git diff --stat`) et 2 bugs connus qui disparaissent (« Contribuer » perd des sommes ; lecture refusée aux partages en lecture seule).
