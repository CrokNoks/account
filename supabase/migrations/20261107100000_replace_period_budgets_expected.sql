-- replace_period_budgets: refuse the replacement when the budgets of the period are no
-- longer the ones the caller loaded (two people editing the same shared account).
--
-- New optional 3rd parameter p_expected: [{ category_id, amount_allocated }] as read by the
-- caller. Absent (NULL) = no check, same behaviour as before (last writer wins). Present
-- (even []) = the current content (category -> amount, amounts at 0 ignored on both sides)
-- must be equal, otherwise ERRCODE 'P0409' and nothing is written.
--
-- The check and the write are indivisible: a transaction-level advisory lock on the period
-- serializes the callers that send p_expected; the second one waits, then (READ COMMITTED:
-- each statement sees what the first one committed) reads the new content and is refused.
-- No FOR UPDATE on periods: it would depend on the UPDATE policy of the caller.
--
-- The old 2-parameter function is dropped first: keeping both would make a call with two
-- named parameters ambiguous. A call with two parameters resolves to this function
-- (p_expected defaults to NULL).
--
-- Rollback: recreate the 2-parameter function of 20261030100200_atomic_replace_period_budgets.sql
-- after `DROP FUNCTION public.replace_period_budgets(uuid, jsonb, jsonb);`.
-- Deployment order: this migration, then the API, then the front.
DROP FUNCTION IF EXISTS public.replace_period_budgets(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.replace_period_budgets(
  p_period_id uuid,
  p_budgets jsonb DEFAULT '[]'::jsonb,
  p_expected jsonb DEFAULT NULL
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

  IF p_expected IS NOT NULL THEN
    IF jsonb_typeof(p_expected) <> 'array' THEN
      RAISE EXCEPTION 'p_expected must be a JSON array' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_period_id::text, 0));

    IF EXISTS (
      (
        SELECT bi.category_id, bi.amount_allocated
        FROM public.budget_instances bi
        WHERE bi.period_id = p_period_id AND bi.amount_allocated <> 0
        EXCEPT
        SELECT e.category_id, e.amount_allocated
        FROM jsonb_to_recordset(p_expected) AS e(category_id uuid, amount_allocated bigint)
        WHERE e.amount_allocated <> 0
      )
      UNION ALL
      (
        SELECT e.category_id, e.amount_allocated
        FROM jsonb_to_recordset(p_expected) AS e(category_id uuid, amount_allocated bigint)
        WHERE e.amount_allocated <> 0
        EXCEPT
        SELECT bi.category_id, bi.amount_allocated
        FROM public.budget_instances bi
        WHERE bi.period_id = p_period_id AND bi.amount_allocated <> 0
      )
    ) THEN
      RAISE EXCEPTION 'budgets changed' USING ERRCODE = 'P0409';
    END IF;
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

REVOKE ALL ON FUNCTION public.replace_period_budgets(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_period_budgets(uuid, jsonb, jsonb) TO authenticated;
