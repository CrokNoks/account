-- Function to calculate historical stats for each category of an account
-- based on transaction history grouped by period.

CREATE OR REPLACE FUNCTION public.get_category_historical_stats(p_account_id UUID)
RETURNS TABLE (
    category_id UUID,
    min_real NUMERIC,
    max_real NUMERIC,
    avg_real NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
      history.category_id,
      MIN(history.total_amount)::NUMERIC as min_real,
      MAX(history.total_amount)::NUMERIC as max_real,
      AVG(history.total_amount)::NUMERIC as avg_real
    FROM (
      SELECT t.category_id, t.period_id, SUM(t.amount) as total_amount
      FROM public.transactions t
      WHERE t.account_id = p_account_id
      AND t.category_id IS NOT NULL
      AND t.period_id IS NOT NULL
      GROUP BY t.category_id, t.period_id
    ) as history
    GROUP BY history.category_id;
END;
$$;
