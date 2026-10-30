-- Atomic writes (5/8): create or modify ONE transaction.
--
-- The API used to upsert the transaction, delete its tags (error ignored), then insert
-- the new tags: three requests, so a failure left a transaction without its tags.
-- save_transaction does the three steps in ONE transaction and every error is raised.
--
-- SECURITY INVOKER: RLS of the caller applies. The upsert is an INSERT ... ON CONFLICT
-- DO UPDATE exactly like PostgREST's upsert did, so the triggers behave as before:
-- BEFORE INSERT assign_period_id (only fills a NULL period_id), BEFORE UPDATE
-- updated_at, AFTER INSERT/UPDATE sync_savings_goal_amount (OLD/NEW balance).
--
-- Payload element shape: see public.insert_transactions (tag_ids = the full tag list,
-- it REPLACES the existing tags).

-- Upserts transactions and replaces their tags.
CREATE OR REPLACE FUNCTION public.upsert_transactions(p_transactions jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_transactions IS NULL OR jsonb_typeof(p_transactions) <> 'array' THEN
    RAISE EXCEPTION 'p_transactions must be a JSON array' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transactions (
    id, account_id, category_id, period_id, date, description, amount,
    reconciled, pending, payment_method, notes, metadata, savings_goal_id,
    created_at, updated_at
  )
  SELECT
    t.id, t.account_id, t.category_id, t.period_id, t.date, t.description, t.amount,
    t.reconciled, t.pending, t.payment_method, t.notes, COALESCE(t.metadata, '{}'::jsonb),
    t.savings_goal_id, t.created_at, t.updated_at
  FROM jsonb_to_recordset(p_transactions) AS t(
    id uuid, account_id uuid, category_id uuid, period_id uuid, date date,
    description text, amount bigint, reconciled boolean, pending boolean,
    payment_method text, notes text, metadata jsonb, savings_goal_id uuid,
    created_at timestamptz, updated_at timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    account_id = EXCLUDED.account_id,
    category_id = EXCLUDED.category_id,
    period_id = EXCLUDED.period_id,
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    reconciled = EXCLUDED.reconciled,
    pending = EXCLUDED.pending,
    payment_method = EXCLUDED.payment_method,
    notes = EXCLUDED.notes,
    metadata = EXCLUDED.metadata,
    savings_goal_id = EXCLUDED.savings_goal_id,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  DELETE FROM public.transaction_tags
  WHERE transaction_id IN (
    SELECT t.id FROM jsonb_to_recordset(p_transactions) AS t(id uuid)
  );

  INSERT INTO public.transaction_tags (transaction_id, tag_id)
  SELECT DISTINCT t.id, tag.tag_id::uuid
  FROM jsonb_to_recordset(p_transactions) AS t(id uuid, tag_ids jsonb),
       LATERAL jsonb_array_elements_text(COALESCE(t.tag_ids, '[]'::jsonb)) AS tag(tag_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_transaction(p_transaction jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_transaction IS NULL OR jsonb_typeof(p_transaction) <> 'object' THEN
    RAISE EXCEPTION 'p_transaction must be a JSON object' USING ERRCODE = '22023';
  END IF;

  PERFORM public.upsert_transactions(jsonb_build_array(p_transaction));
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_transactions(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_transaction(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_transactions(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_transaction(jsonb) TO authenticated;
