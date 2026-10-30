-- Atomic writes (3/4): replacement of the budgets of a period.
--
-- The API used to delete all the budgets of the period then insert the new ones with
-- two requests: a failure on the insert (e.g. a duplicated category) left the period
-- without any budget. Both statements now run in ONE transaction.
--
-- SECURITY INVOKER: RLS of the caller applies (a caller without write access to the
-- period's account deletes nothing and the insert is refused, which rolls back).
--
-- p_budgets: [{ id, period_id, category_id, amount_allocated, created_at, updated_at }]
-- (may be empty: then the period just loses its budgets). Each period_id must be p_period_id.
CREATE OR REPLACE FUNCTION public.replace_period_budgets(
  p_period_id uuid,
  p_budgets jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_period_id IS NULL THEN
    RAISE EXCEPTION 'p_period_id is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_budgets, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_budgets must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_budgets, '[]'::jsonb)) AS b(period_id uuid)
    WHERE b.period_id IS DISTINCT FROM p_period_id
  ) THEN
    RAISE EXCEPTION 'every budget must belong to period %', p_period_id USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.budget_instances WHERE period_id = p_period_id;

  INSERT INTO public.budget_instances (id, period_id, category_id, amount_allocated, created_at, updated_at)
  SELECT b.id, b.period_id, b.category_id, b.amount_allocated, b.created_at, b.updated_at
  FROM jsonb_to_recordset(COALESCE(p_budgets, '[]'::jsonb)) AS b(
    id uuid, period_id uuid, category_id uuid, amount_allocated bigint,
    created_at timestamptz, updated_at timestamptz
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_period_budgets(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_period_budgets(uuid, jsonb) TO authenticated;
