-- Mesure d'impact : factures pending issues de récurrentes en double (attendu : 0 ligne).
-- Lecture seule (transaction read only, annulée en fin).
-- Lancement (base locale) :
--   docker exec -i supabase_db_account-v2 psql -U postgres < specs/suppression-periode-propre/mesure.sql
-- Prod : à lancer par Lucas avec ses accès, avant/après.
begin read only;

select
  account_id,
  metadata->>'recurringId' as recurring_id,
  date_trunc('month', coalesce((metadata->>'dueDate')::date, date))::date as mois,
  count(*) as nb
from public.transactions
where pending = true
  and metadata->>'source' = 'recurring'
group by 1, 2, 3
having count(*) > 1
order by nb desc, mois;

rollback;
