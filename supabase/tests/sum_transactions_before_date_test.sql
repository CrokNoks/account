-- sum_transactions_before_date : somme visible pour le propriétaire et le lecteur, 0 pour un tiers
-- (la RLS cache les lignes), refusée à anon.
-- Lancement (Supabase local uniquement) : npm run test:sql
--   ou psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/sum_transactions_before_date_test.sql
-- La migration 20261125100100_sum_transactions_before_date_invoker.sql doit être appliquée ; tout est annulé (ROLLBACK).
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'sum-owner@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'sum-reader@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000a3', 'sum-stranger@example.com');

INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000a1', 'Partagé', 'aaaaaaaa-0000-4000-8000-0000000000a1');

INSERT INTO public.account_shares (account_id, user_id, permission) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a2', 'read');

-- 3 transactions avant le 1er mars (somme 7000), 1 le 1er mars (exclue : strictement avant)
INSERT INTO public.transactions (account_id, date, description, amount, pending) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000a1', '2026-01-10', 'a', 10000, false),
  ('bbbbbbbb-0000-4000-8000-0000000000a1', '2026-02-10', 'b', -2500, false),
  ('bbbbbbbb-0000-4000-8000-0000000000a1', '2026-02-20', 'c', -500, true),
  ('bbbbbbbb-0000-4000-8000-0000000000a1', '2026-03-01', 'd', -999, false);

-- Appelant : rôle + identité JWT (auth.uid())
CREATE FUNCTION pg_temp.as_user(p_role text, p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(text, uuid) TO PUBLIC;

CREATE FUNCTION pg_temp.total() RETURNS bigint LANGUAGE sql AS $$
  SELECT public.sum_transactions_before_date('bbbbbbbb-0000-4000-8000-0000000000a1', DATE '2026-03-01') $$;
GRANT EXECUTE ON FUNCTION pg_temp.total() TO PUBLIC;

-- Propriétaire
SELECT pg_temp.as_user('authenticated', 'aaaaaaaa-0000-4000-8000-0000000000a1');
DO $$ BEGIN ASSERT pg_temp.total() = 7000, 'le propriétaire doit obtenir 7000, reçu ' || pg_temp.total(); END $$;
RESET ROLE;

-- Partage en lecture
SELECT pg_temp.as_user('authenticated', 'aaaaaaaa-0000-4000-8000-0000000000a2');
DO $$ BEGIN ASSERT pg_temp.total() = 7000, 'le lecteur doit obtenir 7000, reçu ' || pg_temp.total(); END $$;
RESET ROLE;

-- Autre utilisateur : la RLS cache les lignes
SELECT pg_temp.as_user('authenticated', 'aaaaaaaa-0000-4000-8000-0000000000a3');
DO $$ BEGIN ASSERT pg_temp.total() = 0, 'un tiers doit obtenir 0, reçu ' || pg_temp.total(); END $$;
RESET ROLE;

-- anon : refusé
SELECT pg_temp.as_user('anon', 'aaaaaaaa-0000-4000-8000-0000000000a3');
DO $$
DECLARE refused boolean := false;
BEGIN
  BEGIN
    PERFORM pg_temp.total();
  EXCEPTION WHEN insufficient_privilege THEN
    refused := true;
  END;
  ASSERT refused, 'anon ne doit pas pouvoir exécuter la fonction';
END $$;
RESET ROLE;

-- Définition : exécutée avec les droits de l'appelant, search_path figé
DO $$
DECLARE f pg_proc%ROWTYPE;
BEGIN
  SELECT * INTO f FROM pg_proc WHERE oid = 'public.sum_transactions_before_date(uuid, date)'::regprocedure;
  ASSERT NOT f.prosecdef, 'la fonction ne doit plus être SECURITY DEFINER';
  ASSERT f.proconfig::text LIKE '%search_path=public, pg_temp%', 'search_path doit être figé, reçu ' || COALESCE(f.proconfig::text, 'NULL');
END $$;

ROLLBACK;
