-- Mesure d'impact « échéance d'origine des récurrentes » : échéances risquant d'être comptées deux fois.
-- Une récurrente encore projetée (transaction `pending` issue d'une récurrente) alors qu'une transaction non pending
-- du même compte, même catégorie, même signe, datée à 7 jours ou moins de la sienne, l'a déjà réglée.
-- Indicateur : cible 0 après livraison côté Échéances (le calcul est fait par le back, pas en SQL : cette requête ne
-- prouve pas qu'il les écarte, elle dénombre les cas existants ; la preuve est `alreadyPaidCount` du log
-- `cashflow_forecast_built` et le contrôle visuel de l'écran Échéances).
-- Colonnes : echeance = metadata.dueDate si posée, sinon la date de la transaction pending.
--            avec_echeance_posee = nombre de ces pending qui portent metadata.dueDate (posé seulement après le déploiement).
-- Lecture seule. Un seul SELECT (compatible avec une session en lecture seule).
-- Lancement local : docker exec -i supabase_db_account-v2 psql -U postgres < supabase/queries/echeances-comptees-deux-fois.sql
-- Lancement distant : PGOPTIONS='-c default_transaction_read_only=on' psql "<url>" -f supabase/queries/echeances-comptees-deux-fois.sql
SELECT p.account_id,
       count(DISTINCT p.id) AS echeances_deja_reglees,
       count(DISTINCT p.id) FILTER (WHERE p.metadata ? 'dueDate') AS avec_echeance_posee,
       min(coalesce((p.metadata->>'dueDate')::date, p.date)) AS premiere_echeance,
       max(coalesce((p.metadata->>'dueDate')::date, p.date)) AS derniere_echeance
FROM public.transactions p
JOIN public.transactions s
  ON s.account_id = p.account_id
 AND s.id <> p.id
 AND NOT s.pending
 AND s.category_id = p.category_id
 AND sign(s.amount) = sign(p.amount)
 AND abs(s.date - p.date) <= 7
WHERE p.pending
  AND p.metadata->>'source' = 'recurring'
  AND p.category_id IS NOT NULL
GROUP BY p.account_id
ORDER BY echeances_deja_reglees DESC;
