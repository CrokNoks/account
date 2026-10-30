-- Atomic writes (1/4): transfers.
--
-- supabase-js has no transaction: the API used to insert the debit then the credit
-- with two separate requests, so a failure on the second left a one-sided transfer.
-- These functions run all the writes of an operation in ONE transaction (a plpgsql
-- function body is atomic: any error rolls everything back).
--
-- SECURITY INVOKER (explicit) on purpose: the RLS policies of the caller keep
-- applying to every statement, and so do the table triggers (assign_period_id,
-- updated_at, sync_savings_goal_amount).

-- Inserts new transactions and their tags. Each element of p_transactions:
-- { id, account_id, category_id, period_id, date, description, amount, reconciled,
--   pending, payment_method, notes, metadata, savings_goal_id, created_at,
--   updated_at, tag_ids: [uuid, ...] }
-- Tags are stored in the junction table transaction_tags (duplicates are ignored).
CREATE OR REPLACE FUNCTION public.insert_transactions(p_transactions jsonb)
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
  );

  INSERT INTO public.transaction_tags (transaction_id, tag_id)
  SELECT DISTINCT t.id, tag.tag_id::uuid
  FROM jsonb_to_recordset(p_transactions) AS t(id uuid, tag_ids jsonb),
       LATERAL jsonb_array_elements_text(COALESCE(t.tag_ids, '[]'::jsonb)) AS tag(tag_id);
END;
$$;

-- Virement: debit and credit written together or not at all.
CREATE OR REPLACE FUNCTION public.create_transfer(p_debit jsonb, p_credit jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_debit IS NULL OR p_credit IS NULL THEN
    RAISE EXCEPTION 'p_debit and p_credit are required' USING ERRCODE = '22023';
  END IF;

  PERFORM public.insert_transactions(jsonb_build_array(p_debit, p_credit));
END;
$$;

REVOKE ALL ON FUNCTION public.insert_transactions(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_transfer(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_transactions(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transfer(jsonb, jsonb) TO authenticated;
