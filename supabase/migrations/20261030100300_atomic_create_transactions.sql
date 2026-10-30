-- Atomic writes (4/4): bulk import of transactions.
--
-- The API used to insert one transaction per line (then its tags in the junction
-- table transaction_tags): a failure on line N left lines 1..N-1 imported. All the
-- lines and their tags are now written in ONE transaction (all or nothing).
--
-- SECURITY INVOKER: RLS of the caller applies; table triggers (assign_period_id,
-- sync_savings_goal_amount, ...) run for every inserted row.
--
-- p_transactions: same shape as public.insert_transactions (migration
-- 20261030100000_atomic_create_transfer.sql), including tag_ids.
CREATE OR REPLACE FUNCTION public.create_transactions(p_transactions jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.insert_transactions(p_transactions);
END;
$$;

REVOKE ALL ON FUNCTION public.create_transactions(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_transactions(jsonb) TO authenticated;
