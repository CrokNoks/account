-- Trois départs avant une date, en un seul balayage : tout (comme sum_transactions_before_date),
-- les pointées seules (« En banque »), les non `pending` (« À venir »).
-- Additive : sum_transactions_before_date reste telle quelle (trésorerie). S'exécute avec les droits de
-- l'appelant (comme 20261125100100) : la RLS de transactions donne 0 pour un compte non lisible.
-- Retour arrière : DROP FUNCTION public.sum_transactions_before_date_by_balance(UUID, DATE);
CREATE OR REPLACE FUNCTION public.sum_transactions_before_date_by_balance(p_account_id UUID, p_date DATE)
RETURNS TABLE (all_total BIGINT, reconciled_total BIGINT, non_pending_total BIGINT)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(amount), 0)::BIGINT,
         COALESCE(SUM(amount) FILTER (WHERE COALESCE(reconciled, false)), 0)::BIGINT,
         COALESCE(SUM(amount) FILTER (WHERE NOT COALESCE(pending, false)), 0)::BIGINT
  FROM public.transactions
  WHERE account_id = p_account_id
    AND date < p_date;
$$;

REVOKE ALL ON FUNCTION public.sum_transactions_before_date_by_balance(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sum_transactions_before_date_by_balance(UUID, DATE) TO authenticated;
