-- Mesure d'impact « budgets fixes du compte » : nombre de catégories en dépassement par période.
-- Une catégorie est en dépassement quand le total réel de ses transactions dans la période
-- dépasse (en valeur absolue) son budget (budget_instances.amount_allocated, centimes).
-- Les transactions « pending » (factures futures) sont exclues, comme dans les soldes.
-- Un budget à 0 est compté (catégorie non configurée proposée à 0 mais avec des dépenses = dépassement).
-- sum(amount) mélange les signes : un remboursement vient en déduction de la dépense (choix assumé, pas de filtre).
-- Lecture seule. Comparer les périodes avant et après la mise en service.
-- Lancement : docker exec -i supabase_db_account-v2 psql -U postgres < supabase/queries/depassements-par-periode.sql
SELECT p.account_id,
       p.start_date,
       p.end_date,
       count(*) FILTER (WHERE abs(coalesce(t.total, 0)) > abs(bi.amount_allocated)) AS categories_en_depassement,
       count(*) AS categories_budgetees
FROM public.periods p
JOIN public.budget_instances bi ON bi.period_id = p.id
LEFT JOIN (
  SELECT period_id, category_id, sum(amount) AS total
  FROM public.transactions
  WHERE NOT coalesce(pending, false)
  GROUP BY period_id, category_id
) t ON t.period_id = p.id AND t.category_id = bi.category_id
GROUP BY p.account_id, p.start_date, p.end_date
ORDER BY p.account_id, p.start_date DESC;
