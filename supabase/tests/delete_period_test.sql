-- Suppression propre d'une période : period_deletion_plan, preview_delete_period, delete_period_clean,
-- choisies par les DATES (spec rattachement-par-dates : plus de transactions.period_id) via period_window_bounds.
-- Lancement (Supabase local uniquement) : npm run test:sql
-- Les migrations 20261126110000, 20261126110100 et rattachement_par_dates doivent être appliquées ; tout est annulé (ROLLBACK).
-- Les cas « deux suppressions simultanées » et « suppression pendant une bascule » demandent deux
-- sessions réelles : ils se jouent à part (voir specs/suppression-periode-propre, vérification réelle).
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'dp-owner@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 'dp-reader@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000c3', 'dp-stranger@example.com');
INSERT INTO public.accounts (id, name, owner_id) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'Partagé', 'aaaaaaaa-0000-4000-8000-0000000000c1'),
  ('bbbbbbbb-0000-4000-8000-0000000000c2', 'Autre', 'aaaaaaaa-0000-4000-8000-0000000000c3');
INSERT INTO public.account_shares (account_id, user_id, permission) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000c2', 'read');
INSERT INTO public.categories (id, name, account_id) VALUES
  ('cccccccc-0000-4000-8000-0000000000c1', 'Salaire', 'bbbbbbbb-0000-4000-8000-0000000000c1');

-- Identifiants : X = période close (fin d'avant 30/11), D = période à supprimer
CREATE FUNCTION pg_temp.acc() RETURNS uuid LANGUAGE sql AS $$ SELECT 'bbbbbbbb-0000-4000-8000-0000000000c1'::uuid $$;
CREATE FUNCTION pg_temp.px() RETURNS uuid LANGUAGE sql AS $$ SELECT 'dddddddd-0000-4000-8000-0000000000a2'::uuid $$;
CREATE FUNCTION pg_temp.pd() RETURNS uuid LANGUAGE sql AS $$ SELECT 'dddddddd-0000-4000-8000-0000000000a1'::uuid $$;
CREATE FUNCTION pg_temp.t(n int) RETURNS uuid LANGUAGE sql AS $$ SELECT ('eeeeeeee-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid $$;

-- Scénario de l'exemple de la spec : bascule faite par erreur le 25/11 (paie 2 800,00)
--   X 25/10 -> 24/11 (close le 24/11, finissait le 30/11), D 25/11 -> 24/12 active, ouverte par le déclencheur
--   t(1) paie déclenchante 25/11 pointée (source recurring, pending faux : le filtre pending la protège)
--   t(2) saisie 18,50 du 27/11 ; t(3..5) récurrentes pending (1/12, 5/12, 10/12) ; t(6) prochaine paie pending 25/12
--   t(7) pending saisie à la main (sans source) ; t(8) récurrente payée ; t(9) côté de virement pending (sans source)
--   t(10) récurrente pending datée avant D (dans X) ; t(11) récurrente pending d'un autre compte, datée dans D
CREATE FUNCTION pg_temp.build() RETURNS void LANGUAGE plpgsql AS $$
DECLARE rec jsonb;
BEGIN
  DELETE FROM public.transactions WHERE account_id IN (pg_temp.acc(), 'bbbbbbbb-0000-4000-8000-0000000000c2');
  DELETE FROM public.periods WHERE account_id = pg_temp.acc();
  INSERT INTO public.periods (id, account_id, start_date, end_date, is_active, opened_by_trigger, closed_period_id, closed_period_end) VALUES
    (pg_temp.px(), pg_temp.acc(), '2026-10-25', '2026-11-24', false, false, NULL, NULL),
    (pg_temp.pd(), pg_temp.acc(), '2026-11-25', '2026-12-24', true, true, pg_temp.px(), '2026-11-30');
  INSERT INTO public.budget_instances (id, period_id, category_id, amount_allocated) VALUES
    (gen_random_uuid(), pg_temp.pd(), 'cccccccc-0000-4000-8000-0000000000c1', 5000);
  rec := '{"source":"recurring","recurringId":"11111111-0000-4000-8000-000000000001","dueDate":"2026-12-01"}';
  INSERT INTO public.transactions (id, account_id, category_id, date, description, amount, pending, metadata) VALUES
    (pg_temp.t(1), pg_temp.acc(), 'cccccccc-0000-4000-8000-0000000000c1', '2026-11-25', 'Paie', 280000, false, rec),
    (pg_temp.t(2), pg_temp.acc(), NULL, '2026-11-27', 'Saisie', -1850, false, '{}'),
    (pg_temp.t(3), pg_temp.acc(), NULL, '2026-12-01', 'Assurance', -4200, true, rec),
    (pg_temp.t(4), pg_temp.acc(), NULL, '2026-12-05', 'Loyer', -75000, true, rec),
    (pg_temp.t(5), pg_temp.acc(), NULL, '2026-12-10', 'Abonnement', -1599, true, rec),
    (pg_temp.t(6), pg_temp.acc(), 'cccccccc-0000-4000-8000-0000000000c1', '2026-12-25', 'Prochaine paie', 280000, true, rec),
    (pg_temp.t(7), pg_temp.acc(), NULL, '2026-12-02', 'Pending à la main', -1000, true, '{}'),
    (pg_temp.t(8), pg_temp.acc(), NULL, '2026-12-03', 'Récurrente payée', -2000, false, rec),
    (pg_temp.t(9), pg_temp.acc(), NULL, '2026-12-04', 'Virement', -3000, true, '{"transferId":"x"}'),
    (pg_temp.t(10), pg_temp.acc(), NULL, '2026-11-10', 'Pending période X', -500, true, rec),
    (pg_temp.t(11), 'bbbbbbbb-0000-4000-8000-0000000000c2', NULL, '2026-12-06', 'Autre compte', -700, true, rec);
END $$;

-- Appel sans exception : le jsonb rendu, ou {"error": SQLSTATE}
CREATE FUNCTION pg_temp.del(p_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN RETURN public.delete_period_clean(p_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLSTATE); END $$;
CREATE FUNCTION pg_temp.prev(p_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN RETURN public.preview_delete_period(p_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLSTATE); END $$;
-- La transaction n est-elle dans la fenêtre de la période p (même helper que la suppression) ?
CREATE FUNCTION pg_temp.inwin(n int, p uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM public.transactions t, public.period_window_bounds(p) b
                 WHERE t.id = pg_temp.t(n) AND t.date >= b.lo AND (b.hi IS NULL OR t.date <= b.hi)) $$;
-- Date inchangée d'une transaction (aucun déplacement)
CREATE FUNCTION pg_temp.d(n int) RETURNS date LANGUAGE sql AS $$ SELECT date FROM public.transactions WHERE id = pg_temp.t(n) $$;
-- Photo de l'état de tout le compte : périodes, transactions, actives, budgets
CREATE FUNCTION pg_temp.snap() RETURNS text LANGUAGE sql AS $$
  SELECT (SELECT COALESCE(string_agg(p::text, '|' ORDER BY p.id), '') FROM public.periods p WHERE p.account_id = pg_temp.acc())
    || '#' || (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.transactions t WHERE t.account_id IN (pg_temp.acc(), 'bbbbbbbb-0000-4000-8000-0000000000c2'))
    || '#' || (SELECT count(*) FROM public.budget_instances WHERE period_id = pg_temp.pd()) $$;

-- 1. Exemple de la spec : 4 pending supprimées, le reste conservé, X rouverte (CA1, CA2, CA4)
SELECT pg_temp.build();
DO $$
DECLARE r jsonb;
BEGIN
  r := public.delete_period_clean(pg_temp.pd());
  ASSERT r = jsonb_build_object('removedPending', 4, 'keptTransactions', 5, 'reopenedPeriodId', pg_temp.px(), 'origin', 'trigger'), 'retour : ' || r::text;
  -- supprimées : les 3 récurrentes + la prochaine paie (datée après la fin de D)
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id IN (pg_temp.t(3), pg_temp.t(4), pg_temp.t(5), pg_temp.t(6))), '4 pending supprimées';
  -- conservées : paie pointée (même avec source recurring), saisie, pending manuelle, récurrente payée, côté de virement
  ASSERT (SELECT count(*) FROM public.transactions WHERE id IN (pg_temp.t(1), pg_temp.t(2), pg_temp.t(7), pg_temp.t(8), pg_temp.t(9))) = 5, '5 conservées';
  ASSERT NOT EXISTS (SELECT 1 FROM public.periods WHERE id = pg_temp.pd()), 'période supprimée';
  ASSERT NOT EXISTS (SELECT 1 FROM public.budget_instances WHERE period_id = pg_temp.pd()), 'budgets supprimés avec elle';
  -- X rouverte : active, fin d'avant la bascule (30/11)
  ASSERT (SELECT is_active FROM public.periods WHERE id = pg_temp.px()), 'X active';
  ASSERT (SELECT end_date FROM public.periods WHERE id = pg_temp.px()) = '2026-11-30', 'X finit le 30/11';
  ASSERT (SELECT count(*) FROM public.periods WHERE account_id = pg_temp.acc() AND is_active) = 1, 'une seule active';
  -- CA8 : aucun déplacement, les conservées apparaissent dans X rouverte par leurs dates (X active : tout depuis son début)
  ASSERT pg_temp.d(1) = '2026-11-25' AND pg_temp.d(2) = '2026-11-27' AND pg_temp.d(8) = '2026-12-03', 'dates inchangées';
  ASSERT pg_temp.inwin(1, pg_temp.px()) AND pg_temp.inwin(2, pg_temp.px()) AND pg_temp.inwin(7, pg_temp.px())
     AND pg_temp.inwin(8, pg_temp.px()) AND pg_temp.inwin(9, pg_temp.px()), 'toutes les conservées de D sont dans la fenêtre de X rouverte';
  -- intactes : pending datée avant D (dans X), pending d'un autre compte (datée dans D)
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = pg_temp.t(10)), 'pending antérieure à D intacte (hors fenêtre de D)';
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = pg_temp.t(11) AND account_id = 'bbbbbbbb-0000-4000-8000-0000000000c2'), 'pending d''un autre compte intacte (filtre account_id)';
END $$;

-- 2. Hors annulation (période manuelle) : pending nettoyées, rien rouvert, conservées inchangées (CA5)
SELECT pg_temp.build();
UPDATE public.periods SET opened_by_trigger = false, closed_period_id = NULL, closed_period_end = NULL WHERE id = pg_temp.pd();
DO $$
DECLARE r jsonb;
BEGIN
  r := public.delete_period_clean(pg_temp.pd());
  ASSERT r = jsonb_build_object('removedPending', 4, 'keptTransactions', 5, 'reopenedPeriodId', NULL, 'origin', 'manual'), 'manuelle : ' || r::text;
  ASSERT pg_temp.d(1) = '2026-11-25' AND pg_temp.d(2) = '2026-11-27' AND pg_temp.d(8) = '2026-12-03', 'conservées inchangées';
  ASSERT NOT (SELECT is_active FROM public.periods WHERE id = pg_temp.px()), 'X non rouverte';
  ASSERT (SELECT end_date FROM public.periods WHERE id = pg_temp.px()) = '2026-11-24', 'fin de X inchangée';
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id IN (pg_temp.t(3), pg_temp.t(4), pg_temp.t(5), pg_temp.t(6))), 'pending nettoyées';
END $$;

-- 3. Autres cas sans réouverture (CA5, décision 3) : suppression simple, pending nettoyées, conservées inchangées.
-- D inactive (fermée [25/11, 24/12]) : la prochaine paie du 25/12 est hors fenêtre, donc conservée (3 supprimées).
DO $$
DECLARE r jsonb; c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['inactive', 'not_last', 'no_link', 'closed_gone', 'closed_not_last'] LOOP
    PERFORM pg_temp.build();
    IF c = 'inactive' THEN
      UPDATE public.periods SET is_active = false WHERE id = pg_temp.pd();
    ELSIF c = 'not_last' THEN
      UPDATE public.periods SET is_active = true WHERE id = pg_temp.pd();
      INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
        ('dddddddd-0000-4000-8000-0000000000a9', pg_temp.acc(), '2027-01-01', '2027-01-31', false);
    ELSIF c = 'no_link' THEN
      UPDATE public.periods SET closed_period_id = NULL, closed_period_end = NULL WHERE id = pg_temp.pd();
    ELSIF c = 'closed_gone' THEN
      DELETE FROM public.periods WHERE id = pg_temp.px();   -- ON DELETE SET NULL : le lien disparaît
      ASSERT (SELECT closed_period_id FROM public.periods WHERE id = pg_temp.pd()) IS NULL, 'lien annulé (FK)';
    ELSIF c = 'closed_not_last' THEN
      -- une période F entre X et D : X ne serait pas la dernière une fois D retirée
      UPDATE public.periods SET end_date = '2026-11-10' WHERE id = pg_temp.px();
      INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
        ('dddddddd-0000-4000-8000-0000000000a8', pg_temp.acc(), '2026-11-15', '2026-11-20', false);
    END IF;
    r := public.delete_period_clean(pg_temp.pd());
    ASSERT (r->>'reopenedPeriodId') IS NULL, c || ' : rien rouvert ' || r::text;
    ASSERT (r->>'removedPending')::int = CASE WHEN c = 'inactive' THEN 3 ELSE 4 END, c || ' : pending nettoyées ' || r::text;
    ASSERT (r->>'keptTransactions')::int = 5, c || ' : 5 conservées';
    ASSERT (c = 'inactive') = EXISTS (SELECT 1 FROM public.transactions WHERE id = pg_temp.t(6)), c || ' : prochaine paie conservée seulement si D est fermée';
    ASSERT pg_temp.d(1) = '2026-11-25' AND pg_temp.d(2) = '2026-11-27', c || ' : conservées inchangées';
    ASSERT NOT EXISTS (SELECT 1 FROM public.periods WHERE id = pg_temp.pd()), c || ' : supprimée';
    ASSERT (SELECT count(*) FROM public.periods WHERE account_id = pg_temp.acc() AND is_active)
         = 0, c || ' : aucune période rouverte, donc aucune active';
  END LOOP;
END $$;

-- 4. Import chaîné A -> B -> C -> D : supprimer D rouvre C avec sa fin planifiée, B et A ne bougent pas ; puis C rouvre B (CA6)
DO $$
DECLARE
  a uuid := 'dddddddd-0000-4000-8000-0000000000b1'; b uuid := 'dddddddd-0000-4000-8000-0000000000b2';
  c uuid := 'dddddddd-0000-4000-8000-0000000000b3'; d uuid := 'dddddddd-0000-4000-8000-0000000000b4';
  snap_a text; snap_b text; r jsonb;
  sw jsonb;
BEGIN
  PERFORM pg_temp.build();
  DELETE FROM public.transactions WHERE account_id IN (pg_temp.acc(), 'bbbbbbbb-0000-4000-8000-0000000000c2');
  DELETE FROM public.periods WHERE account_id = pg_temp.acc();
  INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES (a, pg_temp.acc(), '2026-08-28', NULL, true);
  -- B, C, D insérées avec la fin DÉJÀ réécrite par la bascule suivante (veille) ; closed_prev_end = fin planifiée
  PERFORM public.apply_period_switches(pg_temp.acc(), a, jsonb_build_array(
    jsonb_build_object('closed_id', a, 'close_end', '2026-09-27', 'closed_prev_end', NULL,
      'opened', jsonb_build_object('id', b, 'account_id', pg_temp.acc(), 'start_date', '2026-09-28', 'end_date', '2026-10-27', 'created_at', now(), 'updated_at', now()), 'budgets', '[]'::jsonb),
    jsonb_build_object('closed_id', b, 'close_end', '2026-10-27', 'closed_prev_end', '2026-10-30',
      'opened', jsonb_build_object('id', c, 'account_id', pg_temp.acc(), 'start_date', '2026-10-28', 'end_date', '2026-11-27', 'created_at', now(), 'updated_at', now()), 'budgets', '[]'::jsonb),
    jsonb_build_object('closed_id', c, 'close_end', '2026-11-27', 'closed_prev_end', '2026-11-30',
      'opened', jsonb_build_object('id', d, 'account_id', pg_temp.acc(), 'start_date', '2026-11-28', 'end_date', '2026-12-27', 'created_at', now(), 'updated_at', now()), 'budgets', '[]'::jsonb)));
  INSERT INTO public.transactions (id, account_id, date, description, amount, pending, metadata) VALUES
    (pg_temp.t(1), pg_temp.acc(), '2026-11-28', 'Paie D', 280000, false, '{}'),
    (pg_temp.t(2), pg_temp.acc(), '2026-12-05', 'Pending D', -100, true, '{"source":"recurring"}');
  snap_a := (SELECT p::text FROM public.periods p WHERE id = a);
  snap_b := (SELECT p::text FROM public.periods p WHERE id = b);

  r := public.delete_period_clean(d);
  ASSERT r = jsonb_build_object('removedPending', 1, 'keptTransactions', 1, 'reopenedPeriodId', c, 'origin', 'trigger'), 'D supprimée : ' || r::text;
  ASSERT (SELECT is_active FROM public.periods WHERE id = c), 'C rouverte';
  ASSERT (SELECT end_date FROM public.periods WHERE id = c) = '2026-11-30', 'C retrouve sa fin planifiée (30/11), pas la veille de D';
  ASSERT (SELECT p::text FROM public.periods p WHERE id = a) = snap_a, 'A inchangée';
  ASSERT (SELECT p::text FROM public.periods p WHERE id = b) = snap_b, 'B inchangée';
  ASSERT pg_temp.d(1) = '2026-11-28' AND pg_temp.inwin(1, c), 'paie de D, date inchangée, dans la fenêtre de C rouverte';

  r := public.delete_period_clean(c);
  ASSERT r->>'reopenedPeriodId' = b::text, 'C supprimée : B rouverte ' || r::text;
  ASSERT (SELECT end_date FROM public.periods WHERE id = b) = '2026-10-30' AND (SELECT is_active FROM public.periods WHERE id = b), 'B rouverte avec sa fin planifiée';
  ASSERT (SELECT p::text FROM public.periods p WHERE id = a) = snap_a, 'A toujours inchangée';
  ASSERT pg_temp.d(1) = '2026-11-28' AND pg_temp.inwin(1, b), 'paie dans la fenêtre de B rouverte';
END $$;

-- 5. Atomicité (CA7) : un échec à la suppression de D annule tout (pending, rattachement, réouverture)
SELECT pg_temp.build();
CREATE FUNCTION public.dp_test_boom() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'boom' USING ERRCODE = 'P0001'; END $$;
CREATE TRIGGER dp_boom_delete BEFORE DELETE ON public.periods FOR EACH ROW WHEN (OLD.id = 'dddddddd-0000-4000-8000-0000000000a1') EXECUTE FUNCTION public.dp_test_boom();
DO $$
DECLARE before_state text := pg_temp.snap(); r jsonb;
BEGIN
  r := pg_temp.del(pg_temp.pd());
  ASSERT r = '{"error": "P0001"}', 'échec attendu : ' || r::text;
  ASSERT pg_temp.snap() = before_state, 'échec à la suppression : strictement rien de modifié (pending, période, rattachement, X)';
  ASSERT pg_temp.inwin(1, pg_temp.pd()), 'paie toujours dans D';
END $$;
DROP TRIGGER dp_boom_delete ON public.periods;
-- Échec à la réouverture de X : D et ses pending intactes, rattachement annulé aussi
CREATE TRIGGER dp_boom_reopen BEFORE UPDATE ON public.periods FOR EACH ROW WHEN (OLD.id = 'dddddddd-0000-4000-8000-0000000000a2') EXECUTE FUNCTION public.dp_test_boom();
DO $$
DECLARE before_state text := pg_temp.snap(); r jsonb;
BEGIN
  r := pg_temp.del(pg_temp.pd());
  ASSERT r->>'error' IN ('P0001'), 'échec attendu à la réouverture : ' || r::text;
  ASSERT pg_temp.snap() = before_state, 'échec à la réouverture : D, ses pending et le rattachement intacts, X toujours inactive';
  ASSERT NOT (SELECT is_active FROM public.periods WHERE id = pg_temp.px()), 'X toujours inactive';
END $$;
DROP TRIGGER dp_boom_reopen ON public.periods;
DROP FUNCTION public.dp_test_boom();

-- 6. Une pending pointée entre l'aperçu et la suppression reste (filtre relu) ; l'aperçu annonçait 4
SELECT pg_temp.build();
DO $$
DECLARE p jsonb; r jsonb;
BEGIN
  p := public.preview_delete_period(pg_temp.pd());
  ASSERT (p->>'removedPending')::int = 4, 'aperçu : 4';
  UPDATE public.transactions SET pending = false WHERE id = pg_temp.t(4);   -- pointée entre-temps
  r := public.delete_period_clean(pg_temp.pd());
  ASSERT (r->>'removedPending')::int = 3, 'suppression : 3 (nombre réel, pas celui de l''aperçu) ' || r::text;
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = pg_temp.t(4)), 'la pointée reste';
  ASSERT pg_temp.d(4) = '2026-12-05', 'et garde sa date';
  ASSERT (r->>'keptTransactions')::int = 6, '6 conservées';
END $$;

-- 7. Aperçu : mêmes nombres que la suppression, aucune écriture (CA3)
SELECT pg_temp.build();
DO $$
DECLARE before_state text := pg_temp.snap(); p jsonb; r jsonb;
BEGIN
  p := public.preview_delete_period(pg_temp.pd());
  ASSERT pg_temp.snap() = before_state, 'aperçu : aucune écriture (périodes, transactions, actives, budgets)';
  ASSERT p = jsonb_build_object('removedPending', 4, 'keptTransactions', 5, 'reopenId', pg_temp.px(),
    'reopenStart', '2026-10-25', 'reopenEnd', '2026-11-30', 'origin', 'trigger'), 'aperçu : ' || p::text;
  r := public.delete_period_clean(pg_temp.pd());
  ASSERT p->>'removedPending' = r->>'removedPending' AND p->>'keptTransactions' = r->>'keptTransactions'
     AND p->>'reopenId' = r->>'reopenedPeriodId', 'mêmes nombres que la suppression';
END $$;
-- Aperçu d'une période manuelle : aucune réouverture annoncée
SELECT pg_temp.build();
UPDATE public.periods SET opened_by_trigger = false, closed_period_id = NULL, closed_period_end = NULL WHERE id = pg_temp.pd();
DO $$
DECLARE p jsonb;
BEGIN
  p := public.preview_delete_period(pg_temp.pd());
  ASSERT p->'reopenId' = 'null'::jsonb AND p->>'origin' = 'manual' AND (p->>'removedPending')::int = 4, 'aperçu manuelle : ' || p::text;
END $$;

-- 8. Inconnue : P0002
DO $$
BEGIN
  ASSERT pg_temp.del('dddddddd-0000-4000-8000-0000000000ff') = '{"error": "P0002"}', 'inconnue : P0002';
  ASSERT pg_temp.prev('dddddddd-0000-4000-8000-0000000000ff') = '{"error": "P0002"}', 'aperçu inconnue : P0002';
END $$;

-- 9. Acteurs : lecteur (403, rien modifié, aperçu permis), étranger (404), propriétaire (ok)
SELECT pg_temp.build();
CREATE FUNCTION pg_temp.as_user(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  SET LOCAL ROLE authenticated;
END $$;
CREATE TEMP TABLE dp_state (before_state text, reader_result jsonb, reader_preview jsonb, stranger_result jsonb, stranger_preview jsonb, anon_result jsonb);
GRANT ALL ON dp_state TO PUBLIC;
INSERT INTO dp_state (before_state) VALUES (pg_temp.snap());

SELECT pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000c2');   -- lecteur
UPDATE dp_state SET reader_result = pg_temp.del(pg_temp.pd()), reader_preview = pg_temp.prev(pg_temp.pd());
RESET ROLE;
SELECT pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000c3');   -- étranger
UPDATE dp_state SET stranger_result = pg_temp.del(pg_temp.pd()), stranger_preview = pg_temp.prev(pg_temp.pd());
RESET ROLE;
DO $$
DECLARE s dp_state%ROWTYPE;
BEGIN
  SELECT * INTO s FROM dp_state;
  ASSERT s.reader_result = '{"error": "42501"}', 'lecteur : 403 ' || s.reader_result::text;
  ASSERT (s.reader_preview->>'removedPending')::int = 4, 'lecteur : aperçu permis ' || s.reader_preview::text;
  ASSERT s.stranger_result = '{"error": "P0002"}', 'étranger : 404 ' || s.stranger_result::text;
  ASSERT s.stranger_preview = '{"error": "P0002"}', 'étranger : aperçu 404';
  ASSERT pg_temp.snap() = s.before_state, 'lecteur et étranger : rien modifié (ni période, ni pending, ni X)';
END $$;
-- Anon : pas d'exécution
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.period_deletion_plan(uuid)', 'public.preview_delete_period(uuid)', 'public.delete_period_clean(uuid)'
  ] LOOP
    ASSERT NOT has_function_privilege('anon', f, 'EXECUTE'), 'anon ne peut pas exécuter ' || f;
    ASSERT NOT has_function_privilege('public', f, 'EXECUTE'), 'PUBLIC ne peut pas exécuter ' || f;
    ASSERT has_function_privilege('authenticated', f, 'EXECUTE'), 'authenticated peut exécuter ' || f;
  END LOOP;
END $$;
-- Propriétaire (rôle authenticated, RLS active) : la suppression passe et rouvre X
SELECT pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000c1');
UPDATE dp_state SET reader_result = pg_temp.del(pg_temp.pd());
RESET ROLE;
DO $$
DECLARE s dp_state%ROWTYPE;
BEGIN
  SELECT * INTO s FROM dp_state;
  ASSERT s.reader_result->>'reopenedPeriodId' = pg_temp.px()::text AND (s.reader_result->>'removedPending')::int = 4, 'propriétaire : ' || s.reader_result::text;
  ASSERT (SELECT is_active FROM public.periods WHERE id = pg_temp.px()), 'propriétaire : X rouverte (RLS)';
  ASSERT pg_temp.inwin(1, pg_temp.px()), 'propriétaire : paie dans la fenêtre de X';
END $$;

-- 10. CA8 : créer une période avec injection, la supprimer, la recréer avec injection : une seule occurrence
-- par récurrente. L'injection est celle du back (lignes `pending` source recurring + recurringId + dueDate,
-- passées à create_period_with_budgets, comme CreatePeriodWithBudgetsUseCase).
SELECT pg_temp.build();
DELETE FROM public.transactions WHERE account_id IN (pg_temp.acc(), 'bbbbbbbb-0000-4000-8000-0000000000c2');
DELETE FROM public.periods WHERE account_id = pg_temp.acc();
CREATE FUNCTION pg_temp.create_with_injection(p_period uuid, p_start date, p_end date) RETURNS void LANGUAGE sql AS $$
  SELECT public.create_period_with_budgets(
    jsonb_build_object('id', p_period, 'account_id', pg_temp.acc(), 'start_date', p_start, 'end_date', p_end,
      'is_active', true, 'created_at', now(), 'updated_at', now()),
    '[]'::jsonb,
    (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'account_id', pg_temp.acc(), 'category_id', NULL,
        'date', d.day, 'description', d.label, 'amount', '-1000', 'reconciled', false,
        'pending', true, 'notes', NULL,
        'metadata', jsonb_build_object('source', 'recurring', 'recurringId', d.rid, 'dueDate', d.day),
        'created_at', now(), 'updated_at', now(), 'tag_ids', '[]'::jsonb))
     FROM (VALUES ('11111111-0000-4000-8000-0000000000a1', 'Loyer', p_start + 3),
                  ('11111111-0000-4000-8000-0000000000a2', 'Assurance', p_start + 7)) AS d(rid, label, day))) $$;
SELECT pg_temp.create_with_injection('dddddddd-0000-4000-8000-0000000000e1', '2027-03-01', '2027-03-31');
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.transactions WHERE account_id = pg_temp.acc() AND pending AND metadata->>'source' = 'recurring') = 2,
    'création : 2 pending récurrentes injectées';
  PERFORM public.delete_period_clean('dddddddd-0000-4000-8000-0000000000e1');
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE account_id = pg_temp.acc() AND pending AND metadata->>'source' = 'recurring'),
    'suppression : plus aucune pending récurrente';
END $$;
SELECT pg_temp.create_with_injection('dddddddd-0000-4000-8000-0000000000e2', '2027-03-01', '2027-03-31');
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.transactions WHERE account_id = pg_temp.acc() AND pending AND metadata->>'source' = 'recurring') = 2,
    'recréation : 2 pending en tout (0 doublon)';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE account_id = pg_temp.acc() AND pending AND metadata->>'source' = 'recurring'
    GROUP BY metadata->>'recurringId', date_trunc('month', (metadata->>'dueDate')::date)
    HAVING count(*) > 1), 'une seule occurrence par récurrente et par mois';
END $$;

-- 11. Choix par les dates (CA7) : fermée [01/11, 30/11], récurrentes pending au 01/11, 30/11, 31/10 et 01/12 ;
-- pointée / saisie / importée dans la fenêtre : conservées. Le plan annonce les mêmes nombres que la suppression.
DO $$
DECLARE
  pa uuid := 'dddddddd-0000-4000-8000-0000000000c1'; pb uuid := 'dddddddd-0000-4000-8000-0000000000c2';
  rec jsonb := '{"source":"recurring","recurringId":"11111111-0000-4000-8000-000000000001"}';
  b record; p jsonb; r jsonb;
BEGIN
  DELETE FROM public.transactions WHERE account_id IN (pg_temp.acc(), 'bbbbbbbb-0000-4000-8000-0000000000c2');
  DELETE FROM public.periods WHERE account_id = pg_temp.acc();
  INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
    (pa, pg_temp.acc(), '2026-11-01', '2026-11-30', false),
    (pb, pg_temp.acc(), '2026-12-01', NULL, true);
  INSERT INTO public.transactions (id, account_id, date, description, amount, pending, metadata) VALUES
    (pg_temp.t(1), pg_temp.acc(), '2026-11-01', 'Récurrente au début', -100, true, rec),
    (pg_temp.t(2), pg_temp.acc(), '2026-11-30', 'Récurrente à la fin', -100, true, rec),
    (pg_temp.t(3), pg_temp.acc(), '2026-10-31', 'Récurrente la veille', -100, true, rec),
    (pg_temp.t(4), pg_temp.acc(), '2026-12-01', 'Récurrente le lendemain', -100, true, rec),
    (pg_temp.t(5), pg_temp.acc(), '2026-11-15', 'Pointée', -100, false, rec),
    (pg_temp.t(6), pg_temp.acc(), '2026-11-16', 'Saisie', -100, true, '{}'),
    (pg_temp.t(7), pg_temp.acc(), '2026-11-17', 'Importée', -100, true, '{"source":"import"}');
  SELECT * INTO b FROM public.period_window_bounds(pa);
  ASSERT b.lo = '2026-11-01' AND b.hi = '2026-11-30', 'bornes d''une fermée : début et fin ' || b::text;
  p := public.preview_delete_period(pa);
  ASSERT (p->>'removedPending')::int = 2 AND (p->>'keptTransactions')::int = 3, 'aperçu fermée : 2 supprimées, 3 conservées ' || p::text;
  r := public.delete_period_clean(pa);
  ASSERT r->>'removedPending' = p->>'removedPending' AND r->>'keptTransactions' = p->>'keptTransactions', 'aperçu = suppression';
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id IN (pg_temp.t(1), pg_temp.t(2))), 'bornes incluses : 01/11 et 30/11 supprimées';
  ASSERT (SELECT count(*) FROM public.transactions WHERE id IN (pg_temp.t(3), pg_temp.t(4), pg_temp.t(5), pg_temp.t(6), pg_temp.t(7))) = 5,
    'veille, lendemain, pointée, saisie, importée : conservées';
END $$;

-- 12. Active : récurrente avant la fin ET prochaine paie (fin + 1) supprimées, récurrente avant le début conservée (CA7) ;
-- active sans fin : tout depuis le début. Bornes : active = pas de borne haute.
DO $$
DECLARE
  pa uuid := 'dddddddd-0000-4000-8000-0000000000c3'; pb uuid := 'dddddddd-0000-4000-8000-0000000000c4';
  rec jsonb := '{"source":"recurring","recurringId":"11111111-0000-4000-8000-000000000001"}';
  b record; r jsonb;
BEGIN
  DELETE FROM public.transactions WHERE account_id IN (pg_temp.acc(), 'bbbbbbbb-0000-4000-8000-0000000000c2');
  DELETE FROM public.periods WHERE account_id = pg_temp.acc();
  INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
    (pa, pg_temp.acc(), '2026-11-01', '2026-11-30', true);
  INSERT INTO public.transactions (id, account_id, date, description, amount, pending, metadata) VALUES
    (pg_temp.t(1), pg_temp.acc(), '2026-11-20', 'Avant la fin', -100, true, rec),
    (pg_temp.t(2), pg_temp.acc(), '2026-12-01', 'Prochaine paie (fin + 1)', 100, true, rec),
    (pg_temp.t(3), pg_temp.acc(), '2027-02-10', 'Très tardive', -100, true, rec),
    (pg_temp.t(4), pg_temp.acc(), '2026-10-31', 'Avant le début', -100, true, rec);
  SELECT * INTO b FROM public.period_window_bounds(pa);
  ASSERT b.lo = '2026-11-01' AND b.hi IS NULL, 'bornes d''une active : pas de borne haute ' || b::text;
  r := public.delete_period_clean(pa);
  ASSERT (r->>'removedPending')::int = 3, 'active : 3 supprimées (prochaine paie comprise) ' || r::text;
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = pg_temp.t(4)), 'avant le début : conservée';
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id IN (pg_temp.t(1), pg_temp.t(2), pg_temp.t(3))), 'les autres supprimées';
END $$;

-- 13. Fermée sans fin avec une suivante (cas du canard) : la fenêtre de suppression s'arrête à la veille de la suivante ;
-- la pending de la suivante (J+40) est conservée. Sans suivante : pas de borne haute.
DO $$
DECLARE
  pa uuid := 'dddddddd-0000-4000-8000-0000000000c5'; pb uuid := 'dddddddd-0000-4000-8000-0000000000c6';
  rec jsonb := '{"source":"recurring","recurringId":"11111111-0000-4000-8000-000000000001"}';
  b record; r jsonb;
BEGIN
  DELETE FROM public.transactions WHERE account_id IN (pg_temp.acc(), 'bbbbbbbb-0000-4000-8000-0000000000c2');
  DELETE FROM public.periods WHERE account_id = pg_temp.acc();
  -- Défense en profondeur : l'index d'exclusion periods_no_overlap interdit déjà une fermée sans fin suivie d'une
  -- autre période. On le retire (le test est annulé par ROLLBACK) pour prouver que le helper borne quand même.
  ALTER TABLE public.periods DROP CONSTRAINT periods_no_overlap;
  INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
    (pa, pg_temp.acc(), '2026-09-01', NULL, false),
    (pb, pg_temp.acc(), '2026-10-01', '2026-10-31', false);
  INSERT INTO public.transactions (id, account_id, date, description, amount, pending, metadata) VALUES
    (pg_temp.t(1), pg_temp.acc(), '2026-09-15', 'Dans la fermée', -100, true, rec),
    (pg_temp.t(2), pg_temp.acc(), '2026-10-11', 'Dans la suivante (J+40)', -100, true, rec);
  SELECT * INTO b FROM public.period_window_bounds(pa);
  ASSERT b.lo = '2026-09-01' AND b.hi = '2026-09-30', 'fermée sans fin : veille de la suivante ' || b::text;
  r := public.delete_period_clean(pa);
  ASSERT (r->>'removedPending')::int = 1, 'une seule supprimée ' || r::text;
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = pg_temp.t(2)), 'celle de la suivante est conservée';
  SELECT * INTO b FROM public.period_window_bounds(pb);
  ASSERT b.hi = '2026-10-31', 'avec fin : sa fin';
  UPDATE public.periods SET end_date = NULL WHERE id = pb;
  SELECT * INTO b FROM public.period_window_bounds(pb);
  ASSERT b.hi IS NULL, 'fermée sans fin et sans suivante : pas de borne haute';
  ASSERT (SELECT count(*) FROM public.period_window_bounds('dddddddd-0000-4000-8000-0000000000ff')) = 0, 'période inconnue : aucune borne';
END $$;

-- 14. Plus de colonne ni de trigger de rattachement
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'period_id'),
    'transactions.period_id supprimée';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'assign_period_id'), 'assign_period_id supprimée';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_transactions_period_id'), 'trigger supprimé';
  ASSERT NOT has_function_privilege('anon', 'public.period_window_bounds(uuid)', 'EXECUTE'), 'anon ne peut pas exécuter period_window_bounds';
  ASSERT has_function_privilege('authenticated', 'public.period_window_bounds(uuid)', 'EXECUTE'), 'authenticated peut exécuter period_window_bounds';
END $$;

-- 15. get_category_historical_stats : la période d'une transaction vient de ses dates (hors de toute période : ignorée)
DO $$
DECLARE r record;
BEGIN
  DELETE FROM public.transactions WHERE account_id IN (pg_temp.acc(), 'bbbbbbbb-0000-4000-8000-0000000000c2');
  DELETE FROM public.periods WHERE account_id = pg_temp.acc();
  INSERT INTO public.periods (id, account_id, start_date, end_date, is_active) VALUES
    ('dddddddd-0000-4000-8000-0000000000c7', pg_temp.acc(), '2026-09-01', '2026-09-30', false),
    ('dddddddd-0000-4000-8000-0000000000c8', pg_temp.acc(), '2026-10-01', '2026-10-31', true);
  INSERT INTO public.transactions (id, account_id, category_id, date, description, amount) VALUES
    (pg_temp.t(1), pg_temp.acc(), 'cccccccc-0000-4000-8000-0000000000c1', '2026-09-10', 'Septembre 1', -1000),
    (pg_temp.t(2), pg_temp.acc(), 'cccccccc-0000-4000-8000-0000000000c1', '2026-09-30', 'Septembre 2', -500),
    (pg_temp.t(3), pg_temp.acc(), 'cccccccc-0000-4000-8000-0000000000c1', '2026-11-20', 'Octobre (active, après la fin)', -3000),
    (pg_temp.t(4), pg_temp.acc(), 'cccccccc-0000-4000-8000-0000000000c1', '2026-08-31', 'Avant toute période', -99999);
  SELECT * INTO r FROM public.get_category_historical_stats(pg_temp.acc());
  ASSERT r.min_real = -3000 AND r.max_real = -1500 AND r.avg_real = -2250, 'stats par période, par les dates : ' || r::text;
END $$;

ROLLBACK;
