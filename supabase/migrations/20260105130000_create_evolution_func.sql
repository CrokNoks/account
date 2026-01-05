CREATE OR REPLACE FUNCTION get_evolution_data(p_account_id UUID)
RETURNS TABLE (
  period_id UUID,
  period_start DATE,
  period_end DATE,
  category_id UUID,
  category_name VARCHAR,
  category_color VARCHAR,
  category_type TEXT,
  total_amount NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as period_id,
    p.start_date as period_start,
    p.end_date as period_end,
    c.id as category_id,
    c.name as category_name,
    c.color as category_color,
    c.type as category_type,
    COALESCE(SUM(e.amount), 0) as total_amount
  FROM periods p
  LEFT JOIN expenses e ON e.account_id = p.account_id 
    AND e.date >= p.start_date 
    AND (p.end_date IS NULL OR e.date <= p.end_date)
  LEFT JOIN categories c ON e.category_id = c.id
  WHERE p.account_id = p_account_id
  GROUP BY p.id, p.start_date, p.end_date, c.id, c.name, c.color, c.type
  ORDER BY p.start_date ASC;
END;
$$;
