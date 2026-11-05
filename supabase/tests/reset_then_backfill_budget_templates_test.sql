-- Mise en service des budgets fixes : le reset vide budget_templates (restes jamais utilisés), puis la reprise remplit depuis la période la plus récente.
-- Une ancienne ligne non nulle est donc écrasée par le reset, pas par la reprise.
-- Lancement : psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/reset_then_backfill_budget_templates_test.sql
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000011', 'bf-reset-1@example.com'),
  ('aaaaaaaa-0000-4000-8000-000000000012', 'bf-reset-2@example.com');
INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000011', 'A', 'aaaaaaaa-0000-4000-8000-000000000011'),
  ('bbbbbbbb-0000-4000-8000-000000000012', 'sans période', 'aaaaaaaa-0000-4000-8000-000000000012');
INSERT INTO public.categories (id, name, account_id) VALUES
  ('cccccccc-0000-4000-8000-000000000011', 'c1', 'bbbbbbbb-0000-4000-8000-000000000011'),
  ('cccccccc-0000-4000-8000-000000000012', 'c2', 'bbbbbbbb-0000-4000-8000-000000000011'),
  ('cccccccc-0000-4000-8000-000000000013', 'c3', 'bbbbbbbb-0000-4000-8000-000000000012');
INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
  ('dddddddd-0000-4000-8000-000000000011', 'bbbbbbbb-0000-4000-8000-000000000011', '2026-10-01', '2026-10-31', true);
INSERT INTO public.budget_instances (period_id, category_id, amount_allocated) VALUES
  ('dddddddd-0000-4000-8000-000000000011', 'cccccccc-0000-4000-8000-000000000011', 50000);

-- Anciennes lignes non nulles : c1 (budget récent différent), c2 (aucun budget récent), c3 (compte sans période)
INSERT INTO public.budget_templates (account_id, category_id, amount_base) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000011', 'cccccccc-0000-4000-8000-000000000011', 4242),
  ('bbbbbbbb-0000-4000-8000-000000000011', 'cccccccc-0000-4000-8000-000000000012', 999),
  ('bbbbbbbb-0000-4000-8000-000000000012', 'cccccccc-0000-4000-8000-000000000013', 777);

\ir ../migrations/20261105100000_reset_budget_templates.sql
\ir ../migrations/20261105100100_backfill_budget_templates.sql

DO $$
BEGIN
  ASSERT (SELECT amount_base FROM public.budget_templates WHERE category_id = 'cccccccc-0000-4000-8000-000000000011') = 50000, 'c1 : ancienne ligne non nulle remplacée par le budget de la dernière période';
  ASSERT NOT EXISTS (SELECT 1 FROM public.budget_templates WHERE category_id = 'cccccccc-0000-4000-8000-000000000012'), 'c2 : ancienne ligne supprimée, rien à reprendre';
  ASSERT NOT EXISTS (SELECT 1 FROM public.budget_templates WHERE category_id = 'cccccccc-0000-4000-8000-000000000013'), 'c3 : compte sans période, ancienne ligne supprimée';
  ASSERT (SELECT count(*) FROM public.budget_templates WHERE account_id IN ('bbbbbbbb-0000-4000-8000-000000000011','bbbbbbbb-0000-4000-8000-000000000012')) = 1, 'une seule ligne au final';
END $$;

ROLLBACK;
