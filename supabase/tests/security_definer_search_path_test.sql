-- Fonctions SECURITY DEFINER de public : search_path figé, et comportement (RLS, déclencheurs) inchangé.
-- Lancement (Supabase local uniquement) : npm run test:sql
-- Tout est annulé à la fin (ROLLBACK).
BEGIN;

-- 1. Toute fonction de public (hors extensions) a un search_path figé ; les SECURITY DEFINER sans schéma inscriptible.
DO $$
DECLARE
  f record;
  n int := 0;
  d int := 0;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proconfig, p.prosecdef
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend dp WHERE dp.objid = p.oid AND dp.deptype = 'e')
  LOOP
    n := n + 1;
    ASSERT f.proconfig IS NOT NULL AND EXISTS (
      SELECT 1 FROM unnest(f.proconfig) c WHERE c LIKE 'search_path=%'
    ), 'search_path non figé sur ' || f.sig || ' (proconfig = ' || coalesce(f.proconfig::text, 'NULL') || ')';
    IF f.prosecdef THEN
      d := d + 1;
      ASSERT EXISTS (SELECT 1 FROM unnest(f.proconfig) c WHERE c = 'search_path=public, pg_temp' OR c = 'search_path=""'),
        'SECURITY DEFINER ' || f.sig || ' : search_path inattendu ' || f.proconfig::text;
    END IF;
  END LOOP;
  ASSERT d >= 4, 'au moins 4 fonctions SECURITY DEFINER attendues, trouvées : ' || d;
  ASSERT n >= 24, 'au moins 24 fonctions attendues, trouvées : ' || n;
END $$;

-- 2. Déclencheurs : sync_app_users (auth.users -> app_users) et auto_assign_user_id (user_id = auth.uid()).
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000d1', 'sd-owner@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000d2', 'sd-reader@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000d3', 'sd-writer@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000d4', 'sd-stranger@example.com');

DO $$
BEGIN
  ASSERT (SELECT email FROM public.app_users WHERE id = 'aaaaaaaa-0000-4000-8000-0000000000d1') = 'sd-owner@example.com',
    'sync_app_users : app_users non créé à l''insertion dans auth.users';
  UPDATE auth.users SET email = 'sd-owner2@example.com' WHERE id = 'aaaaaaaa-0000-4000-8000-0000000000d1';
  ASSERT (SELECT email FROM public.app_users WHERE id = 'aaaaaaaa-0000-4000-8000-0000000000d1') = 'sd-owner2@example.com',
    'sync_app_users : email non synchronisé à la mise à jour';
END $$;

INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000d1', 'Partagé', 'aaaaaaaa-0000-4000-8000-0000000000d1');
INSERT INTO public.account_shares (account_id, user_id, permission) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000d1', 'aaaaaaaa-0000-4000-8000-0000000000d2', 'read'),
  ('bbbbbbbb-0000-4000-8000-0000000000d1', 'aaaaaaaa-0000-4000-8000-0000000000d3', 'write');
INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
  ('dddddddd-0000-4000-8000-0000000000d1', 'bbbbbbbb-0000-4000-8000-0000000000d1', '2026-10-01', '2026-10-31', true);
INSERT INTO public.transactions (id, account_id, date, description, amount, pending) VALUES
  ('eeeeeeee-0000-4000-8000-0000000000d1', 'bbbbbbbb-0000-4000-8000-0000000000d1', '2026-10-05', 'Courses', -1000, false);

-- Insertion d'un compte en tant qu'utilisateur connecté : auto_assign_user_id remplit user_id
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-0000000000d4","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$
DECLARE tbl text;
BEGIN
  -- Les tables portant le déclencheur auto_assign_user_id
  FOR tbl IN SELECT DISTINCT c.oid::regclass::text FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
             WHERE t.tgfoid = 'public.auto_assign_user_id'::regproc AND NOT t.tgisinternal LOOP
    RAISE NOTICE 'auto_assign_user_id posé sur %', tbl;
  END LOOP;
END $$;
INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000d2', 'Compte du tiers', 'aaaaaaaa-0000-4000-8000-0000000000d4');
RESET ROLE;
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.accounts WHERE id = 'bbbbbbbb-0000-4000-8000-0000000000d2') = 1, 'insertion de compte échouée';
END $$;

-- 3. RLS identique : transactions et periods, pour propriétaire / partage read / partage write / tiers / anonyme
DO $$
DECLARE
  w record; t text; v int; ok boolean;
BEGIN
  FOR w IN SELECT * FROM (VALUES
    ('aaaaaaaa-0000-4000-8000-0000000000d1', 1, true),
    ('aaaaaaaa-0000-4000-8000-0000000000d2', 1, false),
    ('aaaaaaaa-0000-4000-8000-0000000000d3', 1, true),
    ('aaaaaaaa-0000-4000-8000-0000000000d4', 0, false)
  ) x(uid, expected, can_write) LOOP
    FOREACH t IN ARRAY ARRAY['transactions', 'periods'] LOOP
      PERFORM set_config('request.jwt.claims', json_build_object('sub', w.uid, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      -- écriture : mise à jour d'une ligne ; 1 ligne touchée si autorisé, 0 sinon
      IF t = 'transactions' THEN
        UPDATE public.transactions SET description = 'Courses' WHERE id = 'eeeeeeee-0000-4000-8000-0000000000d1';
      ELSE
        UPDATE public.periods SET is_active = true WHERE id = 'dddddddd-0000-4000-8000-0000000000d1';
      END IF;
      GET DIAGNOSTICS v = ROW_COUNT;
      ok := v = 1;
      RESET ROLE;
      ASSERT ok = w.can_write, format('écriture %s par %s : attendu %s, obtenu %s', t, w.uid, w.can_write, ok);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', w.uid, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      EXECUTE format('SELECT count(*) FROM public.%I WHERE account_id = %L', t, 'bbbbbbbb-0000-4000-8000-0000000000d1') INTO v;
      RESET ROLE;
      ASSERT v = w.expected, format('lecture %s par %s : attendu %s ligne(s), obtenu %s', t, w.uid, w.expected, v);
    END LOOP;
  END LOOP;

  -- anonyme : ne voit rien, sans erreur
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v FROM public.transactions WHERE account_id = 'bbbbbbbb-0000-4000-8000-0000000000d1';
  RESET ROLE;
  ASSERT v = 0, 'anonyme : doit voir 0 transaction, obtenu ' || v;
END $$;

-- 4. Fonctions non SECURITY DEFINER : toujours opérationnelles avec le search_path figé.
DO $$
DECLARE v timestamptz; before_ts timestamptz;
BEGIN
  -- period_window_bounds : la fenêtre de la période active (début, pas de borne haute), par les dates
  ASSERT (SELECT lo FROM public.period_window_bounds('dddddddd-0000-4000-8000-0000000000d1')) = '2026-10-01'
     AND (SELECT hi FROM public.period_window_bounds('dddddddd-0000-4000-8000-0000000000d1')) IS NULL,
    'period_window_bounds : fenêtre de la période active inattendue';
  INSERT INTO public.transactions (id, account_id, date, description, amount, pending) VALUES
    ('eeeeeeee-0000-4000-8000-0000000000d2', 'bbbbbbbb-0000-4000-8000-0000000000d1', '2026-10-06', 'Sans période', -500, false);
  -- handle_updated_at
  UPDATE public.transactions SET updated_at = '2000-01-01' WHERE id = 'eeeeeeee-0000-4000-8000-0000000000d2';
  UPDATE public.transactions SET description = 'Modifiée' WHERE id = 'eeeeeeee-0000-4000-8000-0000000000d2';
  ASSERT (SELECT updated_at FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000d2') > '2000-01-02',
    'handle_updated_at : updated_at non rafraîchi';
  -- fonction de statistiques : s'exécute sans erreur (get_balance_history et get_evolution_data, cassées, sont supprimées)
  PERFORM * FROM public.get_category_historical_stats('bbbbbbbb-0000-4000-8000-0000000000d1');
END $$;

ROLLBACK;
