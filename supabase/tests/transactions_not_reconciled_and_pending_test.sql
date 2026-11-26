-- Contrainte transactions_not_reconciled_and_pending : (pointée, pending) = (vrai, vrai) refusé à l'insertion
-- et à la modification ; les trois autres états passent.
-- Lancement (Supabase local uniquement) : npm run test:sql
-- La migration 20261126100100_transactions_not_reconciled_and_pending.sql doit être appliquée ; tout est annulé (ROLLBACK).
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'chk-owner@example.com');
INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'Contrainte', 'aaaaaaaa-0000-4000-8000-0000000000c1');

-- Les trois états autorisés
INSERT INTO public.transactions (id, account_id, date, description, amount, reconciled, pending) VALUES
  ('cccccccc-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-0000000000c1', '2026-03-01', 'cb', -100, false, false),
  ('cccccccc-0000-4000-8000-0000000000c2', 'bbbbbbbb-0000-4000-8000-0000000000c1', '2026-03-02', 'pointée', -100, true, false),
  ('cccccccc-0000-4000-8000-0000000000c3', 'bbbbbbbb-0000-4000-8000-0000000000c1', '2026-03-03', 'facture', -100, false, true);

-- P8 : insertion (vrai, vrai) refusée
DO $$
DECLARE refused boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.transactions (account_id, date, description, amount, reconciled, pending)
    VALUES ('bbbbbbbb-0000-4000-8000-0000000000c1', '2026-03-04', 'les deux', -100, true, true);
  EXCEPTION WHEN check_violation THEN
    refused := true;
  END;
  ASSERT refused, 'insérer (pointée, pending) doit être refusé';
END $$;

-- P8 : pointer une facture sans retirer pending refusé ; poser pending sur une pointée refusé
DO $$
DECLARE refused boolean := false;
BEGIN
  BEGIN
    UPDATE public.transactions SET reconciled = true WHERE id = 'cccccccc-0000-4000-8000-0000000000c3';
  EXCEPTION WHEN check_violation THEN
    refused := true;
  END;
  ASSERT refused, 'pointer une facture pending sans retirer pending doit être refusé';
END $$;

DO $$
DECLARE refused boolean := false;
BEGIN
  BEGIN
    UPDATE public.transactions SET pending = true WHERE id = 'cccccccc-0000-4000-8000-0000000000c2';
  EXCEPTION WHEN check_violation THEN
    refused := true;
  END;
  ASSERT refused, 'poser pending sur une pointée doit être refusé';
END $$;

-- Pointer en retirant pending dans la même écriture : accepté (comportement de l'API)
UPDATE public.transactions SET reconciled = true, pending = false WHERE id = 'cccccccc-0000-4000-8000-0000000000c3';
DO $$
BEGIN
  ASSERT (SELECT reconciled AND NOT pending FROM public.transactions WHERE id = 'cccccccc-0000-4000-8000-0000000000c3'),
    'pointer en retirant pending doit passer';
END $$;

ROLLBACK;
