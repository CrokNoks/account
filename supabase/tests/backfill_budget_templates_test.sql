-- Reprise des budgets fixes : la période la plus récente de chaque compte remplit budget_templates (lignes absentes ou à 0), sans jamais écraser une ligne non nulle.
-- Lancement : psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/backfill_budget_templates_test.sql
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'bf-test-1@example.com'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'bf-test-2@example.com');

INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', 'A', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'B', 'aaaaaaaa-0000-4000-8000-000000000002'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'sans période', 'aaaaaaaa-0000-4000-8000-000000000002');

-- Compte A : c1 nouveau, c2 ligne à 0, c3 ligne non nulle, c4 négatif, c5 budget 0 sans ligne,
-- c6 budget 0 avec ligne non nulle, c7 seulement dans l'ancienne période, c8 avec récurrente seulement
INSERT INTO public.categories (id, name, account_id) VALUES
  ('cccccccc-0000-4000-8000-000000000001', 'c1', 'bbbbbbbb-0000-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000002', 'c2', 'bbbbbbbb-0000-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000003', 'c3', 'bbbbbbbb-0000-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000004', 'c4', 'bbbbbbbb-0000-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000005', 'c5', 'bbbbbbbb-0000-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000006', 'c6', 'bbbbbbbb-0000-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000007', 'c7', 'bbbbbbbb-0000-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000008', 'c8', 'bbbbbbbb-0000-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000009', 'b1', 'bbbbbbbb-0000-4000-8000-000000000002');

-- Ancienne période insérée en dernier : le tri porte sur end_date, pas sur l'ordre d'insertion
INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
  ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '2026-09-01', '2026-09-30', false),
  ('dddddddd-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', '2026-10-01', '2026-10-31', true),
  ('dddddddd-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', '2026-03-01', '2026-03-31', true);

INSERT INTO public.budget_instances (period_id, category_id, amount_allocated) VALUES
  -- ancienne période de A (ne doit rien reprendre)
  ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 1111),
  ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000007', 7777),
  -- période récente de A
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001', 50000),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000002', 20000),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000003', 30000),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000004', -8000),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000005', 0),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000006', 0),
  -- compte B
  ('dddddddd-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-000000000009', 9900);

INSERT INTO public.recurring_transactions (account_id, category_id, description, amount, day_of_month) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000008', 'abonnement', 12000, 5);

-- Lignes de configuration préexistantes
INSERT INTO public.budget_templates (account_id, category_id, amount_base) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000002', 0),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000003', 4242),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000006', 6000);

\ir ../migrations/20261105100100_backfill_budget_templates.sql

CREATE FUNCTION pg_temp.tpl(cat text) RETURNS bigint LANGUAGE sql AS $f$
  SELECT amount_base FROM public.budget_templates
  WHERE category_id = ('cccccccc-0000-4000-8000-00000000000' || cat)::uuid
$f$;

DO $$
BEGIN
  ASSERT pg_temp.tpl('1') = 50000, 'c1 : période à end_date la plus récente (pas l''ancienne)';
  ASSERT pg_temp.tpl('2') = 20000, 'c2 : ligne à 0 remplie';
  ASSERT pg_temp.tpl('3') = 4242, 'c3 : ligne non nulle intacte';
  ASSERT pg_temp.tpl('4') = -8000, 'c4 : négatif copié';
  ASSERT pg_temp.tpl('5') IS NULL, 'c5 : budget 0, aucune ligne créée';
  ASSERT pg_temp.tpl('6') = 6000, 'c6 : budget 0 récent, ligne non nulle intacte';
  ASSERT pg_temp.tpl('7') IS NULL, 'c7 : absente de la période récente, pas de ligne';
  ASSERT pg_temp.tpl('8') IS NULL, 'c8 : récurrentes jamais reprises';
  ASSERT pg_temp.tpl('9') = 9900, 'compte B : sa propre période';
  ASSERT (SELECT count(*) FROM public.budget_templates WHERE account_id = 'bbbbbbbb-0000-4000-8000-000000000001') = 5, 'compte A : 5 lignes (c1 c2 c3 c4 c6)';
  ASSERT (SELECT count(*) FROM public.budget_templates WHERE account_id = 'bbbbbbbb-0000-4000-8000-000000000003') = 0, 'compte sans période : rien';
END $$;

-- Rejeu après que Lucas a changé une valeur non nulle : sa valeur est gardée, aucun doublon
UPDATE public.budget_templates SET amount_base = 777 WHERE category_id = 'cccccccc-0000-4000-8000-000000000001';

\ir ../migrations/20261105100100_backfill_budget_templates.sql

DO $$
BEGIN
  ASSERT pg_temp.tpl('1') = 777, 'rejeu : valeur modifiée gardée';
  ASSERT pg_temp.tpl('2') = 20000 AND pg_temp.tpl('3') = 4242 AND pg_temp.tpl('4') = -8000 AND pg_temp.tpl('6') = 6000, 'rejeu : état stable';
  ASSERT (SELECT count(*) FROM public.budget_templates WHERE account_id = 'bbbbbbbb-0000-4000-8000-000000000001') = 5, 'rejeu : aucun doublon';
END $$;

ROLLBACK;
