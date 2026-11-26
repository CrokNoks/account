-- sum_transactions_before_date_by_balance : trois sommes (tout, pointées, non pending) avant une date,
-- visibles pour le propriétaire et le lecteur, 0 pour un tiers (la RLS cache les lignes), refusées à anon.
-- Lancement (Supabase local uniquement) : npm run test:sql
-- La migration 20261126100000_sum_transactions_before_date_by_balance.sql doit être appliquée ; tout est annulé (ROLLBACK).
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000b1', 'bal-owner@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000b2', 'bal-reader@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000b3', 'bal-stranger@example.com');

INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'Partagé', 'aaaaaaaa-0000-4000-8000-0000000000b1');

INSERT INTO public.account_shares (account_id, user_id, permission) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-0000000000b2', 'read');

-- Exemple A, avant le 1er mars : salaire pointé +2000, loyer pointé -800, CB -60 non pointée,
-- facture électricité -90 pending ; le 1er mars (exclu : strictement avant) : -999 pointée.
INSERT INTO public.transactions (account_id, date, description, amount, reconciled, pending) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000b1', '2026-02-01', 'salaire', 200000, true, false),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', '2026-02-02', 'loyer', -80000, true, false),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', '2026-02-20', 'cb', -6000, false, false),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', '2026-02-25', 'facture', -9000, false, true),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', '2026-03-01', 'après', -999, true, false);

-- Appelant : rôle + identité JWT (auth.uid())
CREATE FUNCTION pg_temp.as_user(p_role text, p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(text, uuid) TO PUBLIC;

-- Une ligne, trois sommes : (all_total, reconciled_total, non_pending_total)
CREATE FUNCTION pg_temp.sums() RETURNS text LANGUAGE sql AS $$
  SELECT all_total || '/' || reconciled_total || '/' || non_pending_total
  FROM public.sum_transactions_before_date_by_balance('bbbbbbbb-0000-4000-8000-0000000000b1', DATE '2026-03-01') $$;
GRANT EXECUTE ON FUNCTION pg_temp.sums() TO PUBLIC;

-- Propriétaire : tout 1200 - 60 - 90 = 1050 ; pointées 1200 ; non pending 1200 - 60 = 1140
SELECT pg_temp.as_user('authenticated', 'aaaaaaaa-0000-4000-8000-0000000000b1');
DO $$ BEGIN ASSERT pg_temp.sums() = '105000/120000/114000', 'le propriétaire doit obtenir 105000/120000/114000, reçu ' || pg_temp.sums(); END $$;
RESET ROLE;

-- Partage en lecture
SELECT pg_temp.as_user('authenticated', 'aaaaaaaa-0000-4000-8000-0000000000b2');
DO $$ BEGIN ASSERT pg_temp.sums() = '105000/120000/114000', 'le lecteur doit obtenir 105000/120000/114000, reçu ' || pg_temp.sums(); END $$;
RESET ROLE;

-- Autre utilisateur : la RLS cache les lignes, 0/0/0 (jamais NULL)
SELECT pg_temp.as_user('authenticated', 'aaaaaaaa-0000-4000-8000-0000000000b3');
DO $$ BEGIN ASSERT pg_temp.sums() = '0/0/0', 'un tiers doit obtenir 0/0/0, reçu ' || pg_temp.sums(); END $$;
RESET ROLE;

-- anon : refusé
SELECT pg_temp.as_user('anon', 'aaaaaaaa-0000-4000-8000-0000000000b3');
DO $$
DECLARE refused boolean := false;
BEGIN
  BEGIN
    PERFORM pg_temp.sums();
  EXCEPTION WHEN insufficient_privilege THEN
    refused := true;
  END;
  ASSERT refused, 'anon ne doit pas pouvoir exécuter la fonction';
END $$;
RESET ROLE;

-- Définition : droits de l'appelant, search_path figé
DO $$
DECLARE f pg_proc%ROWTYPE;
BEGIN
  SELECT * INTO f FROM pg_proc WHERE oid = 'public.sum_transactions_before_date_by_balance(uuid, date)'::regprocedure;
  ASSERT NOT f.prosecdef, 'la fonction ne doit pas être SECURITY DEFINER';
  ASSERT f.proconfig::text LIKE '%search_path=public, pg_temp%', 'search_path doit être figé, reçu ' || COALESCE(f.proconfig::text, 'NULL');
END $$;

ROLLBACK;
