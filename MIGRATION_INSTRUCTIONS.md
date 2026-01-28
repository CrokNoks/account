# Migration Instructions for SQL Changes

## Migration Required: get_evolution_data Function

The following SQL migration needs to be applied to your Supabase database:

### File: `20260127152953_simplify_evolution_func_to_expenses.sql`

### SQL to Execute:

```sql
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
    AND (c.type = 'expense' OR c.type IS NULL)
  GROUP BY p.id, p.start_date, p.end_date, c.id, c.name, c.color, c.type
  ORDER BY p.start_date ASC;
END;
$$;
```

### How to Apply:

#### Option 1: Supabase Dashboard
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the SQL above
4. Click "Run"

#### Option 2: Supabase CLI
If you have Supabase CLI configured:
```bash
supabase db push
```

### What Changed:
- Removed the optional `p_category_type` parameter
- Simplified to always filter on expense categories
- Added condition `(c.type = 'expense' OR c.type IS NULL)` to handle categories without type
- Improved performance by removing unnecessary parameters

### Notes:
- This migration is safe to run as it replaces the existing function
- The function now returns only expense-related data as expected by the UI
- Categories with `NULL` type are still included for backward compatibility