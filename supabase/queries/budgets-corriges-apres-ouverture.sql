-- Mesure d'impact « écraser les montants par défaut depuis une période » : périodes dont les budgets ont été
-- recréés après l'ouverture de la période (le remplacement des budgets supprime puis recrée toutes les lignes :
-- created_at des budgets postérieur à celui de la période). Mesure approchée : ne distingue pas une correction
-- d'un budget de plusieurs, ni une correction manuelle d'un usage du bouton ; un enregistrement sans changement compte.
-- Lecture seule. Comparer le nombre de périodes corrigées par mois avant et après la mise en service.
-- Lancement : docker exec -i supabase_db_account-v2 psql -U postgres < supabase/queries/budgets-corriges-apres-ouverture.sql
SELECT date_trunc('month', p.start_date)::date AS mois,
       count(*) AS periodes,
       count(*) FILTER (WHERE b.corrige) AS periodes_corrigees
FROM public.periods p
JOIN (
  SELECT bi.period_id, bool_or(bi.created_at > p2.created_at + interval '1 minute') AS corrige
  FROM public.budget_instances bi
  JOIN public.periods p2 ON p2.id = bi.period_id
  GROUP BY bi.period_id
) b ON b.period_id = p.id
GROUP BY 1
ORDER BY 1;
