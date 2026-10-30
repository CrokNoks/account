-- Atomic writes (2/4): period creation.
--
-- The API used to deactivate the other periods, insert the period, insert the
-- budgets, then insert the generated recurring transactions with separate requests:
-- a failure in the middle left e.g. no active period, or a period without budgets.
-- This function does everything in ONE transaction.
--
-- SECURITY INVOKER: RLS of the caller applies to every statement; table triggers
-- (updated_at, assign_period_id, sync_savings_goal_amount) keep running.
--
-- p_period:       { id, account_id, start_date, end_date, is_active, created_at, updated_at }
-- p_budgets:      [{ id, period_id, category_id, amount_allocated, created_at, updated_at }]
-- p_transactions: same shape as public.insert_transactions (migration
--                 20261030100000_atomic_create_transfer.sql), period_id set by the caller.
CREATE OR REPLACE FUNCTION public.create_period_with_budgets(
  p_period jsonb,
  p_budgets jsonb DEFAULT '[]'::jsonb,
  p_transactions jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_id uuid := (p_period->>'id')::uuid;
  v_account_id uuid := (p_period->>'account_id')::uuid;
BEGIN
  IF v_period_id IS NULL OR v_account_id IS NULL THEN
    RAISE EXCEPTION 'p_period needs an id and an account_id' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_budgets, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(p_transactions, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_budgets and p_transactions must be JSON arrays' USING ERRCODE = '22023';
  END IF;

  -- 1. At most one active period per account: deactivate the others.
  UPDATE public.periods
  SET is_active = FALSE
  WHERE account_id = v_account_id
    AND is_active = TRUE
    AND id <> v_period_id;

  -- 2. The period itself.
  INSERT INTO public.periods (id, account_id, start_date, end_date, is_active, created_at, updated_at)
  SELECT p.id, p.account_id, p.start_date, p.end_date, p.is_active, p.created_at, p.updated_at
  FROM jsonb_to_record(p_period) AS p(
    id uuid, account_id uuid, start_date date, end_date date, is_active boolean,
    created_at timestamptz, updated_at timestamptz
  );

  -- 3. Budgets (UNIQUE(period_id, category_id): a duplicate raises 23505 and rolls back everything).
  INSERT INTO public.budget_instances (id, period_id, category_id, amount_allocated, created_at, updated_at)
  SELECT b.id, b.period_id, b.category_id, b.amount_allocated, b.created_at, b.updated_at
  FROM jsonb_to_recordset(COALESCE(p_budgets, '[]'::jsonb)) AS b(
    id uuid, period_id uuid, category_id uuid, amount_allocated bigint,
    created_at timestamptz, updated_at timestamptz
  );

  -- 4. Transactions generated from the recurring ones (and their tags, if any).
  PERFORM public.insert_transactions(COALESCE(p_transactions, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.create_period_with_budgets(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_period_with_budgets(jsonb, jsonb, jsonb) TO authenticated;
