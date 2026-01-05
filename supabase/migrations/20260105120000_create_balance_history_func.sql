CREATE OR REPLACE FUNCTION get_balance_history(p_account_id UUID, p_date DATE)
RETURNS TABLE (
  reconciled_sum NUMERIC,
  unreconciled_sum NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE reconciled = true), 0) as reconciled_sum,
    COALESCE(SUM(amount) FILTER (WHERE reconciled = false), 0) as unreconciled_sum
  FROM expenses
  WHERE account_id = p_account_id
    AND date < p_date;
END;
$$;
