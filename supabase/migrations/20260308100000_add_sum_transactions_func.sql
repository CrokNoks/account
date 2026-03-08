CREATE OR REPLACE FUNCTION sum_transactions_before_date(p_account_id UUID, p_date DATE)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(amount), 0)
    FROM transactions
    WHERE account_id = p_account_id
      AND date < p_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
