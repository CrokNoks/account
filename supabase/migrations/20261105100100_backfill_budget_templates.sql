-- Reprise : copie vers budget_templates le budget de chaque catégorie dans la période la plus récente
-- de chaque compte (end_date la plus récente, comme findLastByAccount).
-- Ne remplit que les lignes absentes ou à 0 : une ligne non nulle n'est jamais écrasée (rejouable).
-- Les récurrentes ne sont jamais reprises. Une seule instruction : tout ou rien.
INSERT INTO public.budget_templates (account_id, category_id, amount_base)
SELECT p.account_id, bi.category_id, bi.amount_allocated
FROM (
  SELECT DISTINCT ON (account_id) id, account_id
  FROM public.periods
  ORDER BY account_id, end_date DESC, start_date DESC, id
) p
JOIN public.budget_instances bi ON bi.period_id = p.id
WHERE bi.amount_allocated <> 0
ON CONFLICT (account_id, category_id) DO UPDATE
  SET amount_base = EXCLUDED.amount_base
  WHERE public.budget_templates.amount_base = 0;
