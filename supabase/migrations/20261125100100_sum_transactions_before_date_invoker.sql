-- sum_transactions_before_date lisait les transactions de n'importe quel compte (SECURITY DEFINER,
-- RLS ignorée, appelable par anon). Elle s'exécute désormais avec les droits de l'appelant : la RLS de
-- transactions ne montre que les comptes dont il est propriétaire ou lecteur, les autres donnent 0.
-- Même signature, même résultat pour les comptes accessibles.
CREATE OR REPLACE FUNCTION public.sum_transactions_before_date(p_account_id UUID, p_date DATE)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.transactions
    WHERE account_id = p_account_id
      AND date < p_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sum_transactions_before_date(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sum_transactions_before_date(UUID, DATE) TO authenticated;
