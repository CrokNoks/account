-- Atomic writes (6/8): modify SEVERAL existing transactions (bulk update, ignore anomalies).
--
-- The API used to save the transactions one by one (each with its own tag requests):
-- a failure on the Nth left the first N-1 modified. update_transactions modifies all
-- of them and replaces their tags in ONE transaction.
--
-- SECURITY INVOKER: RLS of the caller applies, triggers behave as for a single save
-- (see 20261030100400_atomic_save_transaction.sql). Unlike upsert_transactions it
-- never creates a row: an id that does not exist (or is not visible to the caller,
-- e.g. deleted in the meantime) raises P0002 and rolls everything back.
--
-- p_transactions: [{ ...full transaction as in insert_transactions, tag_ids }]
CREATE OR REPLACE FUNCTION public.update_transactions(p_transactions jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_transactions IS NULL OR jsonb_typeof(p_transactions) <> 'array' THEN
    RAISE EXCEPTION 'p_transactions must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_transactions) AS t(id uuid)
    WHERE NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.id = t.id)
  ) THEN
    RAISE EXCEPTION 'transaction not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.upsert_transactions(p_transactions);
END;
$$;

REVOKE ALL ON FUNCTION public.update_transactions(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_transactions(jsonb) TO authenticated;
