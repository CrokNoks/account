-- Suppression propre d'une période : period_deletion_plan, preview_delete_period, delete_period_clean.
-- Lancement (Supabase local uniquement) : npm run test:sql
-- Les migrations 20261126110000 et 20261126110100 doivent être appliquées ; tout est annulé (ROLLBACK).
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
--   t(10) récurrente pending d'une AUTRE période (X) ; t(11) récurrente pending d'un autre compte, mais period_id = D
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
  INSERT INTO public.transactions (id, account_id, category_id, period_id, date, description, amount, pending, metadata) VALUES
    (pg_temp.t(1), pg_temp.acc(), 'cccccccc-0000-4000-8000-0000000000c1', pg_temp.pd(), '2026-11-25', 'Paie', 280000, false, rec),
    (pg_temp.t(2), pg_temp.acc(), NULL, pg_temp.pd(), '2026-11-27', 'Saisie', -1850, false, '{}'),
    (pg_temp.t(3), pg_temp.acc(), NULL, pg_temp.pd(), '2026-12-01', 'Assurance', -4200, true, rec),
    (pg_temp.t(4), pg_temp.acc(), NULL, pg_temp.pd(), '2026-12-05', 'Loyer', -75000, true, rec),
    (pg_temp.t(5), pg_temp.acc(), NULL, pg_temp.pd(), '2026-12-10', 'Abonnement', -1599, true, rec),
    (pg_temp.t(6), pg_temp.acc(), 'cccccccc-0000-4000-8000-0000000000c1', pg_temp.pd(), '2026-12-25', 'Prochaine paie', 280000, true, rec),
    (pg_temp.t(7), pg_temp.acc(), NULL, pg_temp.pd(), '2026-12-02', 'Pending à la main', -1000, true, '{}'),
    (pg_temp.t(8), pg_temp.acc(), NULL, pg_temp.pd(), '2026-12-03', 'Récurrente payée', -2000, false, rec),
    (pg_temp.t(9), pg_temp.acc(), NULL, pg_temp.pd(), '2026-12-04', 'Virement', -3000, true, '{"transferId":"x"}'),
    (pg_temp.t(10), pg_temp.acc(), NULL, pg_temp.px(), '2026-11-10', 'Pending période X', -500, true, rec),
    (pg_temp.t(11), 'bbbbbbbb-0000-4000-8000-0000000000c2', NULL, pg_temp.pd(), '2026-12-06', 'Autre compte', -700, true, rec);
END $$;

-- Appel sans exception : le jsonb rendu, ou {"error": SQLSTATE}
CREATE FUNCTION pg_temp.del(p_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN RETURN public.delete_period_clean(p_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLSTATE); END $$;
CREATE FUNCTION pg_temp.prev(p_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN RETURN public.preview_delete_period(p_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLSTATE); END $$;
CREATE FUNCTION pg_temp.pid(n int) RETURNS text LANGUAGE sql AS $$ SELECT COALESCE(period_id::text, 'NULL') FROM public.transactions WHERE id = pg_temp.t(n) $$;
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
  -- règle unique CA4 : les conservées (paie 25/11 et saisie 27/11 comprises) ont pour période X, jamais NULL
  ASSERT pg_temp.pid(1) = pg_temp.px()::text, 'paie déclenchante rattachée à X (qui finit le 30/11)';
  ASSERT pg_temp.pid(2) = pg_temp.px()::text, 'saisie du 27/11 rattachée à X';
  ASSERT pg_temp.pid(7) = pg_temp.px()::text AND pg_temp.pid(8) = pg_temp.px()::text AND pg_temp.pid(9) = pg_temp.px()::text, 'toutes les conservées de D : X';
  -- intactes : pending d'une autre période, pending d'un autre compte (même period_id = D à l'origine)
  ASSERT pg_temp.pid(10) = pg_temp.px()::text, 'pending de X intacte';
  ASSERT EXISTS (SELECT 1 FROM public.transactions WHERE id = pg_temp.t(11) AND account_id = 'bbbbbbbb-0000-4000-8000-0000000000c2'), 'pending d''un autre compte intacte (filtre account_id)';
END $$;

-- 2. Hors annulation (période manuelle) : pending nettoyées, rien rouvert, conservées sans période (CA5)
SELECT pg_temp.build();
UPDATE public.periods SET opened_by_trigger = false, closed_period_id = NULL, closed_period_end = NULL WHERE id = pg_temp.pd();
DO $$
DECLARE r jsonb;
BEGIN
  r := public.delete_period_clean(pg_temp.pd());
  ASSERT r = jsonb_build_object('removedPending', 4, 'keptTransactions', 5, 'reopenedPeriodId', NULL, 'origin', 'manual'), 'manuelle : ' || r::text;
  ASSERT pg_temp.pid(1) = 'NULL' AND pg_temp.pid(2) = 'NULL' AND pg_temp.pid(8) = 'NULL', 'conservées sans période';
  ASSERT NOT (SELECT is_active FROM public.periods WHERE id = pg_temp.px()), 'X non rouverte';
  ASSERT (SELECT end_date FROM public.periods WHERE id = pg_temp.px()) = '2026-11-24', 'fin de X inchangée';
  ASSERT NOT EXISTS (SELECT 1 FROM public.transactions WHERE id IN (pg_temp.t(3), pg_temp.t(4), pg_temp.t(5), pg_temp.t(6))), 'pending nettoyées';
END $$;

-- 3. Autres cas sans réouverture (CA5, décision 3) : suppression simple, 4 pending nettoyées, conservées sans période
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
    ASSERT (r->>'removedPending')::int = 4, c || ' : 4 pending nettoyées';
    ASSERT (r->>'keptTransactions')::int = 5, c || ' : 5 conservées';
    ASSERT pg_temp.pid(1) = 'NULL' AND pg_temp.pid(2) = 'NULL', c || ' : conservées sans période';
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
  INSERT INTO public.transactions (id, account_id, period_id, date, description, amount, pending, metadata) VALUES
    (pg_temp.t(1), pg_temp.acc(), d, '2026-11-28', 'Paie D', 280000, false, '{}'),
    (pg_temp.t(2), pg_temp.acc(), d, '2026-12-05', 'Pending D', -100, true, '{"source":"recurring"}');
  snap_a := (SELECT p::text FROM public.periods p WHERE id = a);
  snap_b := (SELECT p::text FROM public.periods p WHERE id = b);

  r := public.delete_period_clean(d);
  ASSERT r = jsonb_build_object('removedPending', 1, 'keptTransactions', 1, 'reopenedPeriodId', c, 'origin', 'trigger'), 'D supprimée : ' || r::text;
  ASSERT (SELECT is_active FROM public.periods WHERE id = c), 'C rouverte';
  ASSERT (SELECT end_date FROM public.periods WHERE id = c) = '2026-11-30', 'C retrouve sa fin planifiée (30/11), pas la veille de D';
  ASSERT (SELECT p::text FROM public.periods p WHERE id = a) = snap_a, 'A inchangée';
  ASSERT (SELECT p::text FROM public.periods p WHERE id = b) = snap_b, 'B inchangée';
  ASSERT pg_temp.pid(1) = c::text, 'paie de D rattachée à C';

  r := public.delete_period_clean(c);
  ASSERT r->>'reopenedPeriodId' = b::text, 'C supprimée : B rouverte ' || r::text;
  ASSERT (SELECT end_date FROM public.periods WHERE id = b) = '2026-10-30' AND (SELECT is_active FROM public.periods WHERE id = b), 'B rouverte avec sa fin planifiée';
  ASSERT (SELECT p::text FROM public.periods p WHERE id = a) = snap_a, 'A toujours inchangée';
  ASSERT pg_temp.pid(1) = b::text, 'paie rattachée à B';
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
  ASSERT pg_temp.pid(1) = pg_temp.pd()::text, 'paie toujours dans D';
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
  ASSERT pg_temp.pid(4) = pg_temp.px()::text, 'et passe à X';
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
  ASSERT pg_temp.pid(1) = pg_temp.px()::text, 'propriétaire : paie rattachée à X';
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
        'period_id', p_period, 'date', d.day, 'description', d.label, 'amount', '-1000', 'reconciled', false,
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

ROLLBACK;
