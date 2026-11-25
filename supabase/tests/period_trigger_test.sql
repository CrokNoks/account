-- Déclencheur de période : set_period_trigger_category et apply_period_switches.
-- Lancement (Supabase local uniquement) : npm run test:sql
--   ou psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/period_trigger_test.sql
-- La migration 20261125100000_period_trigger.sql doit être appliquée (supabase start / migration up) ;
-- tout est annulé à la fin (ROLLBACK).
-- Le cas « deux déclenchements simultanés » demande deux sessions réelles : il ne tient pas dans
-- une transaction annulée. Il se joue à part (voir specs/declencheur-periode, vérification réelle).
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'pt-owner@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000f2', 'pt-reader@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000f3', 'pt-stranger@example.com');

INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'Partagé', 'aaaaaaaa-0000-4000-8000-0000000000f1'),
  ('bbbbbbbb-0000-4000-8000-0000000000f2', 'Autre', 'aaaaaaaa-0000-4000-8000-0000000000f3');

INSERT INTO public.account_shares (account_id, user_id, permission) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-0000000000f2', 'read');

INSERT INTO public.categories (id, name, account_id) VALUES
  ('cccccccc-0000-4000-8000-0000000000f1', 'Salaire', 'bbbbbbbb-0000-4000-8000-0000000000f1'),
  ('cccccccc-0000-4000-8000-0000000000f2', 'Prime', 'bbbbbbbb-0000-4000-8000-0000000000f1'),
  ('cccccccc-0000-4000-8000-0000000000f3', 'Autre compte', 'bbbbbbbb-0000-4000-8000-0000000000f2');

-- Période active du 1er oct. au 31 oct. ; une transaction déjà saisie le 5 nov. (rattachée à l'active)
INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
  ('dddddddd-0000-4000-8000-0000000000f1', 'bbbbbbbb-0000-4000-8000-0000000000f1', '2026-10-01', '2026-10-31', true);
INSERT INTO public.transactions (id, account_id, category_id, period_id, date, description, amount, pending) VALUES
  ('eeeeeeee-0000-4000-8000-0000000000f1', 'bbbbbbbb-0000-4000-8000-0000000000f1', NULL, 'dddddddd-0000-4000-8000-0000000000f1', '2026-11-05', 'Déjà saisie', -1000, false);

-- Aides
CREATE FUNCTION pg_temp.acc() RETURNS uuid LANGUAGE sql AS $$ SELECT 'bbbbbbbb-0000-4000-8000-0000000000f1'::uuid $$;
CREATE FUNCTION pg_temp.active() RETURNS uuid LANGUAGE sql AS $$ SELECT 'dddddddd-0000-4000-8000-0000000000f1'::uuid $$;
-- Une bascule : clôture de l'active à la veille, ouverture de `p_new` du `p_start` au `p_end`, un budget
CREATE FUNCTION pg_temp.sw(p_closed uuid, p_close_end date, p_new uuid, p_start date, p_end date, p_budgets int DEFAULT 1) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'closed_id', p_closed, 'close_end', p_close_end,
    'opened', jsonb_build_object('id', p_new, 'account_id', pg_temp.acc(), 'start_date', p_start, 'end_date', p_end,
      'created_at', now(), 'updated_at', now()),
    'budgets', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'period_id', p_new,
      'category_id', 'cccccccc-0000-4000-8000-0000000000f1', 'amount_allocated', '5000',
      'created_at', now(), 'updated_at', now())), '[]'::jsonb) FROM generate_series(1, p_budgets))) $$;
-- Une transaction (forme upsert_transactions)
CREATE FUNCTION pg_temp.tx(p_id uuid, p_date date, p_period uuid, p_desc text DEFAULT 'Paie') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('id', p_id, 'account_id', pg_temp.acc(),
    'category_id', 'cccccccc-0000-4000-8000-0000000000f1', 'period_id', p_period, 'date', p_date,
    'description', p_desc, 'amount', '200000', 'reconciled', false, 'pending', false, 'metadata', '{}'::jsonb,
    'created_at', now(), 'updated_at', now(), 'tag_ids', '[]'::jsonb) $$;
-- SQLSTATE de l'appel ('ok' si accepté)
CREATE FUNCTION pg_temp.try(p_expected uuid, p_switches jsonb, p_tx jsonb, p_gen jsonb DEFAULT '[]'::jsonb, p_remove uuid[] DEFAULT '{}', p_update boolean DEFAULT false) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.apply_period_switches(pg_temp.acc(), p_expected, p_switches, p_tx, p_gen, p_remove, p_update);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
CREATE FUNCTION pg_temp.actives() RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(id::text, ','), '') FROM public.periods WHERE account_id = pg_temp.acc() AND is_active $$;

-- 1. Réglage : une seule catégorie déclencheuse par compte
SELECT public.set_period_trigger_category('cccccccc-0000-4000-8000-0000000000f1', true);
DO $$
BEGIN
  ASSERT (SELECT is_period_trigger FROM public.categories WHERE id = 'cccccccc-0000-4000-8000-0000000000f1'), 'Salaire marquée';
  ASSERT (SELECT count(*) FROM public.categories WHERE is_period_trigger AND account_id = pg_temp.acc()) = 1, 'une seule marque';
END $$;
SELECT public.set_period_trigger_category('cccccccc-0000-4000-8000-0000000000f2', true);
DO $$
BEGIN
  ASSERT NOT (SELECT is_period_trigger FROM public.categories WHERE id = 'cccccccc-0000-4000-8000-0000000000f1'), 'marquer une autre retire la première';
  ASSERT (SELECT is_period_trigger FROM public.categories WHERE id = 'cccccccc-0000-4000-8000-0000000000f2'), 'Prime marquée';
END $$;
SELECT public.set_period_trigger_category('cccccccc-0000-4000-8000-0000000000f2', false);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.categories WHERE is_period_trigger AND account_id = pg_temp.acc()) = 0, 'retirer la marque';
  ASSERT (SELECT bool_and(NOT is_period_trigger) FROM public.categories WHERE account_id = pg_temp.acc()), 'plus rien de marqué après retrait';
END $$;

-- 2. Bascule réussie : clôture, ouverture, budget, transaction, rattachement de la déjà saisie
DO $$
DECLARE r jsonb;
BEGIN
  r := public.apply_period_switches(pg_temp.acc(), pg_temp.active(),
    jsonb_build_array(pg_temp.sw(pg_temp.active(), '2026-11-27', 'dddddddd-0000-4000-8000-0000000000f2', '2026-11-28', '2026-12-27')),
    jsonb_build_array(pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000f2', '2026-11-28', 'dddddddd-0000-4000-8000-0000000000f2')),
    jsonb_build_array(pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000a1', '2026-12-05', 'dddddddd-0000-4000-8000-0000000000f2', 'Générée')));
  ASSERT r = '{"switched": true, "removed": 0}'::jsonb, 'bascule : ' || r::text;
  ASSERT (SELECT period_id FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000a1') = 'dddddddd-0000-4000-8000-0000000000f2', 'générée écrite avec la bascule';
  ASSERT pg_temp.actives() = 'dddddddd-0000-4000-8000-0000000000f2', 'une seule active : la nouvelle';
  ASSERT (SELECT end_date FROM public.periods WHERE id = pg_temp.active()) = '2026-11-27', 'ancienne close la veille';
  ASSERT NOT (SELECT is_active FROM public.periods WHERE id = pg_temp.active()), 'ancienne inactive';
  ASSERT (SELECT count(*) FROM public.budget_instances WHERE period_id = 'dddddddd-0000-4000-8000-0000000000f2') = 1, 'budget par défaut posé';
  ASSERT (SELECT period_id FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f2') = 'dddddddd-0000-4000-8000-0000000000f2', 'déclencheuse dans la nouvelle';
  -- la transaction du 5 nov. (avant le 28) reste dans l'ancienne : rattachement par date >= début seulement
  ASSERT (SELECT period_id FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f1') = pg_temp.active(), 'antérieure au début : inchangée';
END $$;

-- 3. Rattachement : une transaction datée après le début est reprise par la nouvelle période, une seule fois
INSERT INTO public.transactions (id, account_id, category_id, period_id, date, description, amount) VALUES
  ('eeeeeeee-0000-4000-8000-0000000000f3', pg_temp.acc(), NULL, 'dddddddd-0000-4000-8000-0000000000f2', '2026-12-02', 'Dans la nouvelle', -500);
DO $$
BEGIN
  -- seconde bascule (>= 15 jours plus tard) : la fin de la précédente est réécrite, la transaction suit sa date
  PERFORM public.apply_period_switches(pg_temp.acc(), 'dddddddd-0000-4000-8000-0000000000f2',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000f2', '2026-12-01', 'dddddddd-0000-4000-8000-0000000000f3', '2026-12-02', '2027-01-01')),
    jsonb_build_array(pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000f4', '2026-12-02', 'dddddddd-0000-4000-8000-0000000000f3')));
  ASSERT (SELECT period_id FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f3') = 'dddddddd-0000-4000-8000-0000000000f3', 'déjà saisie reprise par la nouvelle';
  ASSERT (SELECT count(*) FROM public.transactions WHERE description = 'Dans la nouvelle') = 1, 'comptée une seule fois';
  ASSERT pg_temp.actives() = 'dddddddd-0000-4000-8000-0000000000f3', 'toujours une seule active';
END $$;

-- 4. Échec à l'ouverture (budget en doublon) : tout est annulé, active inchangée, transaction non créée
DO $$
DECLARE before_active text := pg_temp.actives();
BEGIN
  ASSERT pg_temp.try('dddddddd-0000-4000-8000-0000000000f3',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000f3', '2027-01-09', 'dddddddd-0000-4000-8000-0000000000f4', '2027-01-10', '2027-02-09', 2)),
    jsonb_build_array(pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000f5', '2027-01-10', 'dddddddd-0000-4000-8000-0000000000f4'))) = '23505', 'budget en doublon : 23505';
  ASSERT pg_temp.actives() = before_active, 'active inchangée après échec';
  ASSERT (SELECT end_date FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000f3') = '2027-01-01', 'fin de l''active inchangée';
  ASSERT NOT EXISTS (SELECT 1 FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000f4'), 'nouvelle période non créée';
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f5'), 'transaction non créée';
END $$;

-- 5. Chevauchement avec une période existante : 23P01, rien d'écrit
INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
  ('dddddddd-0000-4000-8000-0000000000f9', pg_temp.acc(), '2027-03-01', '2027-03-31', false);
DO $$
BEGIN
  ASSERT pg_temp.try('dddddddd-0000-4000-8000-0000000000f3',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000f3', '2027-01-09', 'dddddddd-0000-4000-8000-0000000000f4', '2027-01-10', '2027-03-15')),
    jsonb_build_array(pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000f5', '2027-01-10', 'dddddddd-0000-4000-8000-0000000000f4'))) = '23P01', 'chevauchement : 23P01';
  ASSERT pg_temp.actives() = 'dddddddd-0000-4000-8000-0000000000f3', 'active inchangée après chevauchement';
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f5'), 'transaction non créée (chevauchement)';
END $$;

-- 6. Déclenchement concurrent perdu (l'active attendue n'est plus l'active) : pas de bascule, ligne enregistrée
DO $$
DECLARE r jsonb;
BEGIN
  r := public.apply_period_switches(pg_temp.acc(), pg_temp.active(),
    jsonb_build_array(pg_temp.sw(pg_temp.active(), '2027-01-09', 'dddddddd-0000-4000-8000-0000000000fa', '2027-01-10', '2027-02-09')),
    jsonb_build_array(pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000f6', '2027-01-10', 'dddddddd-0000-4000-8000-0000000000fa')),
    jsonb_build_array(pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000a2', '2027-01-15', 'dddddddd-0000-4000-8000-0000000000fa', 'Générée perdue')));
  ASSERT r = '{"switched": false, "reason": "concurrent", "removed": 0}'::jsonb, 'concurrent : ' || r::text;
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000a2'), 'bascule perdue : aucune ligne générée écrite (pas de double compte)';
  ASSERT NOT EXISTS (SELECT 1 FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000fa'), 'aucune période créée';
  ASSERT pg_temp.actives() = 'dddddddd-0000-4000-8000-0000000000f3', 'une seule active';
  ASSERT (SELECT period_id FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f6') = 'dddddddd-0000-4000-8000-0000000000f3',
    'ligne enregistrée sans bascule, rattachée à l''active par le trigger';
END $$;

-- 6 bis. Nettoyage de l'import : suppression des pending demandées, dans la même transaction
INSERT INTO public.transactions (id, account_id, category_id, period_id, date, description, amount, pending) VALUES
  ('eeeeeeee-0000-4000-8000-0000000000c1', pg_temp.acc(), NULL, 'dddddddd-0000-4000-8000-0000000000f3', '2027-01-02', 'Pending à supprimer', -500, true),
  ('eeeeeeee-0000-4000-8000-0000000000c2', pg_temp.acc(), NULL, 'dddddddd-0000-4000-8000-0000000000f3', '2027-01-03', 'Déjà pointée', -500, false),
  ('eeeeeeee-0000-4000-8000-0000000000c3', 'bbbbbbbb-0000-4000-8000-0000000000f2', NULL, NULL, '2027-01-03', 'Autre compte', -500, true),
  ('eeeeeeee-0000-4000-8000-0000000000c4', pg_temp.acc(), NULL, 'dddddddd-0000-4000-8000-0000000000f3', '2027-01-04', 'Pending gardée', -500, true);
-- Échec (budget en doublon) : rien n'est supprimé
DO $$
BEGIN
  ASSERT pg_temp.try('dddddddd-0000-4000-8000-0000000000f3',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000f3', '2027-01-09', 'dddddddd-0000-4000-8000-0000000000f4', '2027-01-10', '2027-02-09', 2)),
    '[]'::jsonb, '[]'::jsonb, ARRAY['eeeeeeee-0000-4000-8000-0000000000c1']::uuid[]) = '23505', 'échec : 23505';
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000c1'), 'échec : pending non supprimée';
END $$;
-- Bascule perdue (concurrent) : rien n'est supprimé
DO $$
DECLARE r jsonb;
BEGIN
  r := public.apply_period_switches(pg_temp.acc(), 'dddddddd-0000-4000-8000-0000000000fc',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000f3', '2027-01-09', 'dddddddd-0000-4000-8000-0000000000fa', '2027-01-10', '2027-02-09')),
    '[]'::jsonb, '[]'::jsonb, ARRAY['eeeeeeee-0000-4000-8000-0000000000c1']::uuid[]);
  ASSERT r->>'switched' = 'false' AND (r->>'removed')::int = 0, 'concurrent : ' || r::text;
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000c1'), 'concurrent : pending non supprimée';
END $$;
-- Réussite : seule la pending du compte est supprimée (ni la pointée, ni celle d'un autre compte)
DO $$
DECLARE r jsonb;
BEGIN
  r := public.apply_period_switches(pg_temp.acc(), 'dddddddd-0000-4000-8000-0000000000f3',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000f3', '2027-01-09', 'dddddddd-0000-4000-8000-0000000000fa', '2027-01-10', '2027-02-09')),
    '[]'::jsonb, '[]'::jsonb,
    ARRAY['eeeeeeee-0000-4000-8000-0000000000c1', 'eeeeeeee-0000-4000-8000-0000000000c2', 'eeeeeeee-0000-4000-8000-0000000000c3']::uuid[]);
  ASSERT r = '{"switched": true, "removed": 1}'::jsonb, 'nettoyage : ' || r::text;
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000c1'), 'pending supprimée';
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000c2'), 'pointée conservée';
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000c3'), 'autre compte conservé';
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000c4'), 'non demandée conservée';
END $$;
-- La suite repart de l'active d'avant : on annule la bascule de ce bloc (nouvelle période et clôture)
DELETE FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000fa';
UPDATE public.periods SET is_active = TRUE, end_date = '2027-01-01' WHERE id = 'dddddddd-0000-4000-8000-0000000000f3';

-- 6 ter. Mode modification (p_update) : une transaction de la requête qui n'existe plus -> P0002, rien d'écrit
-- (branche bascule ET branche concurrente) ; la création, elle, insère des lignes nouvelles.
DO $$
BEGIN
  ASSERT pg_temp.try('dddddddd-0000-4000-8000-0000000000f3',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000f3', '2027-01-09', 'dddddddd-0000-4000-8000-0000000000fd', '2027-01-10', '2027-02-09')),
    jsonb_build_array(
      pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000f3', '2027-01-10', 'dddddddd-0000-4000-8000-0000000000fd', 'Modifiée'),
      pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000d1', '2027-01-10', 'dddddddd-0000-4000-8000-0000000000fd', 'Supprimée entre-temps')),
    '[]'::jsonb, '{}', true) = 'P0002', 'modification, ligne disparue (bascule) : P0002';
  ASSERT pg_temp.actives() = 'dddddddd-0000-4000-8000-0000000000f3', 'modification, ligne disparue : active inchangée';
  ASSERT NOT EXISTS (SELECT 1 FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000fd'), 'modification, ligne disparue : aucune période créée';
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000d1'), 'modification, ligne disparue : non recréée';
  ASSERT (SELECT description FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f3') = 'Dans la nouvelle', 'modification, ligne disparue : l''autre ligne inchangée';
  -- branche concurrente (active attendue périmée)
  ASSERT pg_temp.try('dddddddd-0000-4000-8000-0000000000fc',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000f3', '2027-01-09', 'dddddddd-0000-4000-8000-0000000000fd', '2027-01-10', '2027-02-09')),
    jsonb_build_array(
      pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000f3', '2027-01-10', NULL, 'Modifiée'),
      pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000d1', '2027-01-10', NULL, 'Supprimée entre-temps')),
    '[]'::jsonb, '{}', true) = 'P0002', 'modification, ligne disparue (concurrent) : P0002';
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000d1'), 'concurrent : non recréée';
  ASSERT (SELECT description FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f3') = 'Dans la nouvelle', 'concurrent : l''autre ligne inchangée';
  -- toutes les lignes existent : la bascule a lieu et la modification est écrite
  ASSERT pg_temp.try('dddddddd-0000-4000-8000-0000000000f3',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000f3', '2027-01-09', 'dddddddd-0000-4000-8000-0000000000fd', '2027-01-10', '2027-02-09')),
    jsonb_build_array(pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000f3', '2027-01-10', 'dddddddd-0000-4000-8000-0000000000fd', 'Modifiée')),
    '[]'::jsonb, '{}', true) = 'ok', 'modification, toutes les lignes existent : ok';
  ASSERT (SELECT description FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f3') = 'Modifiée', 'modification écrite';
  ASSERT pg_temp.actives() = 'dddddddd-0000-4000-8000-0000000000fd', 'modification : bascule faite';
END $$;
-- La suite repart de l'active d'avant
DELETE FROM public.periods WHERE id = 'dddddddd-0000-4000-8000-0000000000fd';
UPDATE public.periods SET is_active = TRUE, end_date = '2027-01-01' WHERE id = 'dddddddd-0000-4000-8000-0000000000f3';
UPDATE public.transactions SET description = 'Dans la nouvelle', period_id = 'dddddddd-0000-4000-8000-0000000000f3' WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f3';

-- 7. Lecture seule : 42501, rien n'est modifié
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000f2', true);
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT pg_temp.try('dddddddd-0000-4000-8000-0000000000f3',
    jsonb_build_array(pg_temp.sw('dddddddd-0000-4000-8000-0000000000f3', '2027-01-09', 'dddddddd-0000-4000-8000-0000000000fb', '2027-01-10', '2027-02-09')),
    jsonb_build_array(pg_temp.tx('eeeeeeee-0000-4000-8000-0000000000f7', '2027-01-10', 'dddddddd-0000-4000-8000-0000000000fb'))) = '42501', 'lecture seule : 42501';
  ASSERT (SELECT count(*) FROM public.categories WHERE id = 'cccccccc-0000-4000-8000-0000000000f1') = 1, 'lecteur voit la catégorie';
END $$;
-- Réglage en lecture seule : refusé (42501), marque inchangée
DO $$
DECLARE s text;
BEGIN
  BEGIN
    PERFORM public.set_period_trigger_category('cccccccc-0000-4000-8000-0000000000f1', true);
    s := 'ok';
  EXCEPTION WHEN OTHERS THEN s := SQLSTATE;
  END;
  ASSERT s = '42501', 'réglage en lecture seule : 42501, reçu ' || s;
END $$;
RESET ROLE;
DO $$
BEGIN
  ASSERT pg_temp.actives() = 'dddddddd-0000-4000-8000-0000000000f3', 'lecture seule : active inchangée';
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f7'), 'lecture seule : rien écrit';
  ASSERT NOT (SELECT is_period_trigger FROM public.categories WHERE id = 'cccccccc-0000-4000-8000-0000000000f1'), 'lecture seule : marque inchangée';
END $$;

-- 8. Réglage d'une catégorie d'un autre compte : invisible, P0002 (404)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000f1', true);
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
DO $$
DECLARE s text;
BEGIN
  BEGIN
    PERFORM public.set_period_trigger_category('cccccccc-0000-4000-8000-0000000000f3', true);
    s := 'ok';
  EXCEPTION WHEN OTHERS THEN s := SQLSTATE;
  END;
  ASSERT s = 'P0002', 'catégorie d''un autre compte : P0002, reçu ' || s;
END $$;
RESET ROLE;
DO $$
BEGIN
  ASSERT NOT (SELECT is_period_trigger FROM public.categories WHERE id = 'cccccccc-0000-4000-8000-0000000000f3'), 'autre compte : marque inchangée';
END $$;

-- 9. Droits : ni anon ni PUBLIC n'exécutent les deux fonctions, authenticated oui
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.set_period_trigger_category(uuid, boolean)',
    'public.apply_period_switches(uuid, uuid, jsonb, jsonb, jsonb, uuid[], boolean)'
  ] LOOP
    ASSERT NOT has_function_privilege('anon', f, 'EXECUTE'), 'anon ne peut pas exécuter ' || f;
    ASSERT has_function_privilege('authenticated', f, 'EXECUTE'), 'authenticated peut exécuter ' || f;
  END LOOP;
END $$;

ROLLBACK;
