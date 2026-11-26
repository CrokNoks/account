-- Mémoire de bascule : apply_period_switches retient l'origine et la fin d'avant de la période close.
-- Lancement (Supabase local uniquement) : npm run test:sql
-- La migration 20261126110000_period_switch_memory.sql doit être appliquée ; tout est annulé (ROLLBACK).
-- period_trigger_test.sql (comportement de la bascule) reste inchangé et doit passer tel quel.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000e1', 'psm-owner@example.com');
INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000e1', 'Mémoire', 'aaaaaaaa-0000-4000-8000-0000000000e1');

-- Période manuelle : la mémoire reste vide
INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
  ('dddddddd-0000-4000-8000-0000000000e1', 'bbbbbbbb-0000-4000-8000-0000000000e1', '2026-10-25', '2026-11-30', true);

CREATE FUNCTION pg_temp.acc() RETURNS uuid LANGUAGE sql AS $$ SELECT 'bbbbbbbb-0000-4000-8000-0000000000e1'::uuid $$;
-- Une bascule ; p_prev : valeur de closed_prev_end (clé absente si p_with_key faux)
CREATE FUNCTION pg_temp.sw(p_closed uuid, p_close_end date, p_new uuid, p_start date, p_end date,
                           p_with_key boolean, p_prev date DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'closed_id', p_closed, 'close_end', p_close_end,
    'opened', jsonb_build_object('id', p_new, 'account_id', pg_temp.acc(), 'start_date', p_start, 'end_date', p_end,
      'created_at', now(), 'updated_at', now()),
    'budgets', '[]'::jsonb)
    || CASE WHEN p_with_key THEN jsonb_build_object('closed_prev_end', p_prev) ELSE '{}'::jsonb END $$;

DO $$
BEGIN
  ASSERT NOT (SELECT opened_by_trigger FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e1'), 'manuelle : pas ouverte par le déclencheur';
  ASSERT (SELECT closed_period_id IS NULL AND closed_period_end IS NULL FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e1'), 'manuelle : mémoire vide';
END $$;

-- 1. Une bascule, clé transmise : la fin d'avant (30/11) est retenue alors que la clôture la ramène au 24/11
DO $$
BEGIN
  PERFORM public.apply_period_switches(pg_temp.acc(), 'dddddddd-0000-4000-8000-0000000000e1',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000e1', '2026-11-24', 'dddddddd-0000-4000-8000-0000000000e2',
      '2026-11-25', '2026-12-24', true, '2026-11-30')));
  ASSERT (SELECT end_date FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e1') = '2026-11-24', 'close au 24/11';
  ASSERT (SELECT opened_by_trigger FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e2'), 'ouverte par le déclencheur';
  ASSERT (SELECT closed_period_id FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e2') = 'dddddddd-0000-4000-8000-0000000000e1', 'période close retenue';
  ASSERT (SELECT closed_period_end FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e2') = '2026-11-30', 'fin d''avant retenue';
  ASSERT NOT (SELECT opened_by_trigger FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e1'), 'la close n''est pas modifiée par la mémoire';
END $$;

-- 2. Import chaîné C (clé transmise, la fin planifiée de C avant réécriture) puis D
DO $$
BEGIN
  PERFORM public.apply_period_switches(pg_temp.acc(), 'dddddddd-0000-4000-8000-0000000000e2',
    jsonb_build_array(
      -- e2 (fin 24/12) est close au 31/12 ; e3 est insérée avec la fin déjà réécrite par la bascule suivante (24/01)
      pg_temp.sw('dddddddd-0000-4000-8000-0000000000e2', '2026-12-31', 'dddddddd-0000-4000-8000-0000000000e3',
        '2027-01-01', '2027-01-24', true, '2026-12-24'),
      -- e3 est close au 24/01 ; sa fin planifiée (celle d'avant la réécriture) était le 30/01
      pg_temp.sw('dddddddd-0000-4000-8000-0000000000e3', '2027-01-24', 'dddddddd-0000-4000-8000-0000000000e4',
        '2027-01-25', '2027-02-24', true, '2027-01-30')));
  ASSERT (SELECT closed_period_end FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e3') = '2026-12-24', 'e3 : fin d''avant de e2';
  ASSERT (SELECT closed_period_id FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e4') = 'dddddddd-0000-4000-8000-0000000000e3', 'e4 : close e3';
  ASSERT (SELECT closed_period_end FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e4') = '2027-01-30', 'e4 : fin planifiée de e3, pas la réécrite';
  ASSERT (SELECT closed_period_end FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e2') = '2026-11-30', 'e2 garde la fin d''avant de la bascule précédente (e1 : 30/11)';
END $$;

-- 3. Clé absente (ancien back) : la fin est lue en base avant la clôture
DO $$
BEGIN
  PERFORM public.apply_period_switches(pg_temp.acc(), 'dddddddd-0000-4000-8000-0000000000e4',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000e4', '2027-03-09', 'dddddddd-0000-4000-8000-0000000000e5',
      '2027-03-10', '2027-04-09', false)));
  ASSERT (SELECT closed_period_end FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e5') = '2027-02-24', 'clé absente : fin lue en base (24/02)';
  ASSERT (SELECT closed_period_id FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e5') = 'dddddddd-0000-4000-8000-0000000000e4', 'clé absente : période close retenue';
END $$;

-- 4. Clé présente avec null : « elle n'avait pas de fin » (différent de clé absente)
DO $$
BEGIN
  PERFORM public.apply_period_switches(pg_temp.acc(), 'dddddddd-0000-4000-8000-0000000000e5',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000e5', '2027-05-09', 'dddddddd-0000-4000-8000-0000000000e6',
      '2027-05-10', '2027-06-09', true, NULL)));
  ASSERT (SELECT closed_period_end FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e6') IS NULL, 'clé null : pas de fin d''avant, pas de lecture en base';
  ASSERT (SELECT closed_period_id FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e6') = 'dddddddd-0000-4000-8000-0000000000e5', 'clé null : période close retenue';
END $$;

-- 5. Supprimer la période close : le lien disparaît (ON DELETE SET NULL), la période ouverte reste
DELETE FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e1';
DO $$
BEGIN
  ASSERT (SELECT closed_period_id FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e2') IS NULL, 'lien annulé à la suppression de la close';
  ASSERT EXISTS (SELECT 1 FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000e2'), 'ouverte conservée';
END $$;

ROLLBACK;
