-- replace_period_budgets avec p_expected : refus (P0409) si les budgets ne sont plus ceux que l'appelant a lus.
-- Lancement (Supabase local uniquement) : psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/replace_period_budgets_expected_test.sql
-- La migration est rejouée dans la transaction (annulée à la fin).
-- Le cas « deux enregistrements simultanés » demande deux sessions : voir specs/refonte-budgets/conception.md
-- (session 1 : BEGIN; SELECT replace_period_budgets(..., p_expected); pause; COMMIT. session 2 : même appel, attend le verrou puis P0409).
BEGIN;

\ir ../migrations/20261107100000_replace_period_budgets_expected.sql

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000e1', 'rpb-owner@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000e2', 'rpb-reader@example.com');

INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000e1', 'Partagé', 'aaaaaaaa-0000-4000-8000-0000000000e1');

INSERT INTO public.account_shares (account_id, user_id, permission) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-0000000000e2', 'read');

INSERT INTO public.categories (id, name, account_id) VALUES
  ('cccccccc-0000-4000-8000-0000000000e1', 'c1', 'bbbbbbbb-0000-4000-8000-0000000000e1'),
  ('cccccccc-0000-4000-8000-0000000000e2', 'c2', 'bbbbbbbb-0000-4000-8000-0000000000e1'),
  ('cccccccc-0000-4000-8000-0000000000e3', 'c3', 'bbbbbbbb-0000-4000-8000-0000000000e1');

INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
  ('dddddddd-0000-4000-8000-0000000000e1', 'bbbbbbbb-0000-4000-8000-0000000000e1', '2026-10-01', '2026-10-31', true);

-- Aides
CREATE FUNCTION pg_temp.c(n int) RETURNS uuid LANGUAGE sql AS $$ SELECT ('cccccccc-0000-4000-8000-0000000000e' || n)::uuid $$;
CREATE FUNCTION pg_temp.pid() RETURNS uuid LANGUAGE sql AS $$ SELECT 'dddddddd-0000-4000-8000-0000000000e1'::uuid $$;
-- Budget à enregistrer (forme envoyée par l'API)
CREATE FUNCTION pg_temp.b(n int, amount bigint) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('id', gen_random_uuid(), 'period_id', pg_temp.pid(), 'category_id', pg_temp.c(n),
    'amount_allocated', amount::text, 'created_at', now(), 'updated_at', now()) $$;
-- Budget attendu (forme envoyée par l'API)
CREATE FUNCTION pg_temp.e(n int, amount bigint) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('category_id', pg_temp.c(n), 'amount_allocated', amount::text) $$;
-- Contenu actuel « catégorie:montant », trié
CREATE FUNCTION pg_temp.content() RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(right(category_id::text, 1) || ':' || amount_allocated, ',' ORDER BY category_id), '')
  FROM public.budget_instances WHERE period_id = pg_temp.pid() $$;
-- Appelle replace_period_budgets et renvoie le SQLSTATE ('ok' si accepté)
CREATE FUNCTION pg_temp.try(p_budgets jsonb, p_expected jsonb) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.replace_period_budgets(pg_temp.pid(), p_budgets, p_expected);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;

-- Une seule signature (à trois paramètres) : pas d'ambiguïté sur l'appel à deux paramètres
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM pg_proc WHERE proname = 'replace_period_budgets' AND pronamespace = 'public'::regnamespace) = 1,
    'une seule fonction replace_period_budgets';
  ASSERT (SELECT pronargs FROM pg_proc WHERE proname = 'replace_period_budgets' AND pronamespace = 'public'::regnamespace) = 3,
    'trois paramètres';
END $$;

-- État de départ : c1 = 50000, c2 = -40000
SELECT public.replace_period_budgets(pg_temp.pid(), jsonb_build_array(pg_temp.b(1, 50000), pg_temp.b(2, -40000)));

DO $$
BEGIN
  ASSERT pg_temp.content() = '1:50000,2:-40000', 'départ : ' || pg_temp.content();

  -- Attendu == courant : écrit
  ASSERT pg_temp.try(jsonb_build_array(pg_temp.b(1, 60000), pg_temp.b(2, -40000)), jsonb_build_array(pg_temp.e(1, 50000), pg_temp.e(2, -40000))) = 'ok', 'attendu = courant : écrit';
  ASSERT pg_temp.content() = '1:60000,2:-40000', 'attendu = courant : contenu remplacé : ' || pg_temp.content();

  -- Un montant différent : P0409, rien n'est écrit
  ASSERT pg_temp.try(jsonb_build_array(pg_temp.b(1, 1)), jsonb_build_array(pg_temp.e(1, 50000), pg_temp.e(2, -40000))) = 'P0409', 'montant différent : P0409';
  ASSERT pg_temp.content() = '1:60000,2:-40000', 'montant différent : base inchangée';

  -- Catégorie ajoutée par l'autre personne (en base, pas dans l'attendu)
  ASSERT pg_temp.try('[]', jsonb_build_array(pg_temp.e(1, 60000))) = 'P0409', 'catégorie ajoutée par l''autre : P0409';
  -- Catégorie supprimée par l'autre personne (dans l'attendu, plus en base)
  ASSERT pg_temp.try('[]', jsonb_build_array(pg_temp.e(1, 60000), pg_temp.e(2, -40000), pg_temp.e(3, 7000))) = 'P0409', 'catégorie supprimée par l''autre : P0409';
  ASSERT pg_temp.content() = '1:60000,2:-40000', 'refus : base inchangée';

  -- Pas d'attendu (ancien front) : pas de contrôle, écrit
  ASSERT pg_temp.try(jsonb_build_array(pg_temp.b(1, 61000), pg_temp.b(2, -40000)), NULL) = 'ok', 'sans attendu : écrit';
  PERFORM public.replace_period_budgets(pg_temp.pid(), jsonb_build_array(pg_temp.b(1, 62000), pg_temp.b(2, -40000)));
  ASSERT pg_temp.content() = '1:62000,2:-40000', 'appel à deux paramètres : écrit';

  -- Attendu [] : base non vide -> refus ; base vide -> écrit
  ASSERT pg_temp.try('[]', '[]') = 'P0409', 'attendu [] et base non vide : P0409';
  ASSERT pg_temp.try('[]', jsonb_build_array(pg_temp.e(1, 62000), pg_temp.e(2, -40000))) = 'ok', 'vider la période';
  ASSERT pg_temp.content() = '', 'période vide';
  ASSERT pg_temp.try(jsonb_build_array(pg_temp.b(3, 5000)), '[]') = 'ok', 'attendu [] et base vide : écrit';
  ASSERT pg_temp.content() = '3:5000', 'écrit après []';
END $$;

-- 0 = absent, des deux côtés
DO $$
BEGIN
  -- ligne stockée à 0 en base, absente de l'attendu
  UPDATE public.budget_instances SET amount_allocated = 0 WHERE period_id = pg_temp.pid();
  ASSERT pg_temp.content() = '3:0', 'ligne à 0 stockée';
  ASSERT pg_temp.try(jsonb_build_array(pg_temp.b(1, 100)), '[]') = 'ok', 'ligne à 0 en base, absente de l''attendu : égal';
  -- ligne absente en base, attendue à 0
  ASSERT pg_temp.try(jsonb_build_array(pg_temp.b(2, 200)), jsonb_build_array(pg_temp.e(1, 100), pg_temp.e(3, 0))) = 'ok', 'attendu à 0 pour une ligne absente : égal';
  ASSERT pg_temp.content() = '2:200', 'contenu après 0 = absent : ' || pg_temp.content();
END $$;

-- Négatif : comparaison exacte
DO $$
BEGIN
  PERFORM public.replace_period_budgets(pg_temp.pid(), jsonb_build_array(pg_temp.b(1, -40000)));
  ASSERT pg_temp.try(jsonb_build_array(pg_temp.b(1, -40000)), jsonb_build_array(pg_temp.e(1, 40000))) = 'P0409', 'stocké -40000, attendu 40000 : P0409';
  ASSERT pg_temp.try(jsonb_build_array(pg_temp.b(1, -41000)), jsonb_build_array(pg_temp.e(1, -40000))) = 'ok', 'stocké -40000, attendu -40000 : écrit';
  ASSERT pg_temp.content() = '1:-41000', 'négatif écrit';
END $$;

-- p_expected qui n'est pas un tableau
DO $$
BEGIN
  ASSERT pg_temp.try('[]', '{"a":1}'::jsonb) = '22023', 'p_expected non tableau : 22023';
  ASSERT pg_temp.content() = '1:-41000', 'p_expected non tableau : base inchangée';
END $$;

-- Insertion qui échoue après vérification OK : les anciens budgets sont conservés (atomicité)
DO $$
BEGIN
  ASSERT pg_temp.try(jsonb_build_array(pg_temp.b(2, 1), pg_temp.b(2, 2)), jsonb_build_array(pg_temp.e(1, -41000))) = '23505', 'doublon : 23505';
  ASSERT pg_temp.content() = '1:-41000', 'doublon : anciens budgets conservés';
END $$;

-- Lecture seule avec un attendu juste : refus par la RLS comme avant (42501), budgets inchangés
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000e2', true);
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT pg_temp.try(jsonb_build_array(pg_temp.b(1, 1)), jsonb_build_array(pg_temp.e(1, -41000))) = '42501', 'lecture seule : 42501';
END $$;
RESET ROLE;
DO $$
BEGIN
  ASSERT pg_temp.content() = '1:-41000', 'lecture seule : budgets inchangés';
END $$;

ROLLBACK;
