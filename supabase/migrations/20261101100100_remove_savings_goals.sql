-- Remove the savings goals feature.
-- Order matters: functions first (plpgsql bodies are not tracked by dependencies),
-- then the trigger and its function, then the column, then the table. No CASCADE.
-- SECURITY INVOKER (explicit) on purpose, as in the original definitions: the caller's RLS keeps applying.

-- 1. Write functions without savings_goal_id (same bodies otherwise)
CREATE OR REPLACE FUNCTION public.insert_transactions(p_transactions jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_transactions IS NULL OR jsonb_typeof(p_transactions) <> 'array' THEN
    RAISE EXCEPTION 'p_transactions must be a JSON array' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transactions (
    id, account_id, category_id, period_id, date, description, amount,
    reconciled, pending, payment_method, notes, metadata,
    created_at, updated_at
  )
  SELECT
    t.id, t.account_id, t.category_id, t.period_id, t.date, t.description, t.amount,
    t.reconciled, t.pending, t.payment_method, t.notes, COALESCE(t.metadata, '{}'::jsonb),
    t.created_at, t.updated_at
  FROM jsonb_to_recordset(p_transactions) AS t(
    id uuid, account_id uuid, category_id uuid, period_id uuid, date date,
    description text, amount bigint, reconciled boolean, pending boolean,
    payment_method text, notes text, metadata jsonb,
    created_at timestamptz, updated_at timestamptz
  );

  INSERT INTO public.transaction_tags (transaction_id, tag_id)
  SELECT DISTINCT t.id, tag.tag_id::uuid
  FROM jsonb_to_recordset(p_transactions) AS t(id uuid, tag_ids jsonb),
       LATERAL jsonb_array_elements_text(COALESCE(t.tag_ids, '[]'::jsonb)) AS tag(tag_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_transactions(p_transactions jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_transactions IS NULL OR jsonb_typeof(p_transactions) <> 'array' THEN
    RAISE EXCEPTION 'p_transactions must be a JSON array' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transactions (
    id, account_id, category_id, period_id, date, description, amount,
    reconciled, pending, payment_method, notes, metadata,
    created_at, updated_at
  )
  SELECT
    t.id, t.account_id, t.category_id, t.period_id, t.date, t.description, t.amount,
    t.reconciled, t.pending, t.payment_method, t.notes, COALESCE(t.metadata, '{}'::jsonb),
    t.created_at, t.updated_at
  FROM jsonb_to_recordset(p_transactions) AS t(
    id uuid, account_id uuid, category_id uuid, period_id uuid, date date,
    description text, amount bigint, reconciled boolean, pending boolean,
    payment_method text, notes text, metadata jsonb,
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
$function$;

-- 2. Trigger, then its function
DROP TRIGGER trg_sync_savings_goal_on_transaction ON public.transactions;
DROP FUNCTION public.sync_savings_goal_amount();

-- 3. Column (takes its FK and index with it)
ALTER TABLE public.transactions DROP COLUMN savings_goal_id;

-- 4. Table (takes its RLS policy and updated_at trigger with it)
DROP TABLE public.savings_goals;
