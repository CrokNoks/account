-- RETOUR ARRIÈRE de 20261127120000_rattachement_par_dates.sql (spec rattachement-par-dates).
-- La migration supprime transactions.period_id : un simple revert du code ne suffit plus. Ce script la recrée,
-- recalcule les valeurs par les dates et remet les anciennes fonctions. Aucune information n'est perdue
-- (period_id se déduit des dates). À lancer À LA MAIN (psql / SQL editor), jamais comme migration ; rejoué sur
-- base locale avant la mise en prod (voir la spec, rubrique Exploitation).
--
-- Ordre à suivre : (1) ce script ; (2) seulement ensuite, redéployer l'ancien back puis l'ancien front.
-- Les requêtes de mesure « avant » (supabase/queries/rattachement-par-dates.sql) se lancent AVANT la migration.
--
-- Étapes de ce script (une seule transaction) :
--   1. recréer la colonne, sa FK (ON DELETE SET NULL) et son index (20251229111000_add_period_id_to_expenses.sql) ;
--   2. recalculer period_id par les dates, même règle que l'ancien rattachement (20261125100000_period_trigger.sql) :
--      une seule période par ligne (periods_no_overlap), l'active n'a pas de borne de fin, la prochaine paie
--      lui revient ; une ligne hors de toute période reste vide, comme avant ;
--   3. rejouer les définitions d'avant : assign_period_id + trigger set_transactions_period_id
--      (20261101100100_remove_savings_goals.sql), insert_transactions / upsert_transactions
--      (20261030100x00 + search_path 20261127100000), apply_period_switches (20261126110000),
--      period_deletion_plan / delete_period_clean (20261126110100), get_category_historical_stats ;
--   4. retirer le helper period_window_bounds, qui n'existait pas avant.
-- Les droits (EXECUTE) des fonctions rejouées sont conservés (CREATE OR REPLACE).
-- Ce que le recalcul ne restaure pas : les period_id posés « à la main » par l'ancien code qui ne suivaient pas
-- les dates (par exemple une ligne saisie dans une période qui n'était plus l'active au moment de l'insertion) ;
-- ils se déduisent désormais des dates, c'est le comportement voulu.

BEGIN;

-- 1. La colonne, sa FK et son index.
ALTER TABLE public.transactions ADD COLUMN period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_period_id ON public.transactions (period_id);

-- 2. Recalcul par les dates (même règle que l'ancien rattachement).
UPDATE public.transactions t
SET period_id = p.id
FROM public.periods p
WHERE p.account_id = t.account_id
  AND t.date >= p.start_date
  AND (p.end_date IS NULL OR t.date <= p.end_date OR p.is_active);

-- 3. Les anciennes définitions (recopiées telles qu'elles étaient en base avant la migration).

-- 3a. Attribution à l'insertion (trigger)
CREATE OR REPLACE FUNCTION public.assign_period_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_period_id UUID;
BEGIN
  -- Only assign if not provided
  IF NEW.period_id IS NULL THEN
    SELECT id INTO v_period_id
    FROM public.periods
    WHERE account_id = NEW.account_id
      AND is_active = TRUE
    LIMIT 1;

    -- Fallback: If no active period matches, find strictly by date range?
    -- Requirement says "active period at that moment". If importing old data, this might be tricky.
    -- Assuming "active at that moment" means the period currently marked active in the system.
    
    IF v_period_id IS NOT NULL THEN
      NEW.period_id := v_period_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE TRIGGER set_transactions_period_id BEFORE INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.assign_period_id();

-- 3b. insert_transactions
CREATE OR REPLACE FUNCTION public.insert_transactions(p_transactions jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_transactions IS NULL OR jsonb_typeof(p_transactions) <> 'array' THEN
    RAISE EXCEPTION 'p_transactions must be a JSON array' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transactions (
    id, account_id, category_id, period_id, date, description, amount,
    reconciled, pending, notes, metadata,
    created_at, updated_at
  )
  SELECT
    t.id, t.account_id, t.category_id, t.period_id, t.date, t.description, t.amount,
    t.reconciled, t.pending, t.notes, COALESCE(t.metadata, '{}'::jsonb),
    t.created_at, t.updated_at
  FROM jsonb_to_recordset(p_transactions) AS t(
    id uuid, account_id uuid, category_id uuid, period_id uuid, date date,
    description text, amount bigint, reconciled boolean, pending boolean,
    notes text, metadata jsonb,
    created_at timestamptz, updated_at timestamptz
  );

  INSERT INTO public.transaction_tags (transaction_id, tag_id)
  SELECT DISTINCT t.id, tag.tag_id::uuid
  FROM jsonb_to_recordset(p_transactions) AS t(id uuid, tag_ids jsonb),
       LATERAL jsonb_array_elements_text(COALESCE(t.tag_ids, '[]'::jsonb)) AS tag(tag_id);
END;
$function$
;

-- 3c. upsert_transactions
CREATE OR REPLACE FUNCTION public.upsert_transactions(p_transactions jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_transactions IS NULL OR jsonb_typeof(p_transactions) <> 'array' THEN
    RAISE EXCEPTION 'p_transactions must be a JSON array' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transactions (
    id, account_id, category_id, period_id, date, description, amount,
    reconciled, pending, notes, metadata,
    created_at, updated_at
  )
  SELECT
    t.id, t.account_id, t.category_id, t.period_id, t.date, t.description, t.amount,
    t.reconciled, t.pending, t.notes, COALESCE(t.metadata, '{}'::jsonb),
    t.created_at, t.updated_at
  FROM jsonb_to_recordset(p_transactions) AS t(
    id uuid, account_id uuid, category_id uuid, period_id uuid, date date,
    description text, amount bigint, reconciled boolean, pending boolean,
    notes text, metadata jsonb,
    created_at timestamptz, updated_at timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    account_id = EXCLUDED.account_id,
    category_id = EXCLUDED.category_id,
    period_id = EXCLUDED.period_id,
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    reconciled = EXCLUDED.reconciled,
    pending = EXCLUDED.pending,
    notes = EXCLUDED.notes,
    metadata = EXCLUDED.metadata,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  DELETE FROM public.transaction_tags
  WHERE transaction_id IN (
    SELECT t.id FROM jsonb_to_recordset(p_transactions) AS t(id uuid)
  );

  INSERT INTO public.transaction_tags (transaction_id, tag_id)
  SELECT DISTINCT t.id, tag.tag_id::uuid
  FROM jsonb_to_recordset(p_transactions) AS t(id uuid, tag_ids jsonb),
       LATERAL jsonb_array_elements_text(COALESCE(t.tag_ids, '[]'::jsonb)) AS tag(tag_id);
END;
$function$
;

-- 3d. apply_period_switches (avec rattachement)
CREATE OR REPLACE FUNCTION public.apply_period_switches(p_account_id uuid, p_expected_active_id uuid, p_switches jsonb, p_transactions jsonb DEFAULT '[]'::jsonb, p_generated jsonb DEFAULT '[]'::jsonb, p_remove_pending_ids uuid[] DEFAULT '{}'::uuid[], p_update boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_active_id uuid;
  v_switch jsonb;
  v_count integer;
  v_planned uuid[];
  v_removed integer := 0;
  v_prev_end date;
BEGIN
  IF p_account_id IS NULL OR p_expected_active_id IS NULL THEN
    RAISE EXCEPTION 'p_account_id and p_expected_active_id are required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_switches, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_switches) = 0
     OR jsonb_typeof(COALESCE(p_transactions, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(p_generated, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_switches must be a non-empty JSON array, p_transactions and p_generated JSON arrays'
      USING ERRCODE = '22023';
  END IF;

  -- 1. Verrou de la période active : sérialise les déclenchements concurrents.
  SELECT id INTO v_active_id
  FROM public.periods
  WHERE account_id = p_account_id AND is_active
  FOR UPDATE;

  -- Mode modification : verrouille puis vérifie que chaque ligne existe encore (même erreur
  -- que update_transactions). Le verrou vient après celui de la période : ordre constant.
  IF p_update THEN
    PERFORM 1
    FROM public.transactions
    WHERE id IN (SELECT (t->>'id')::uuid FROM jsonb_array_elements(COALESCE(p_transactions, '[]'::jsonb)) AS t)
    FOR UPDATE;

    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(COALESCE(p_transactions, '[]'::jsonb)) AS t(id uuid)
      WHERE NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.id = t.id)
    ) THEN
      RAISE EXCEPTION 'transaction not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_active_id IS DISTINCT FROM p_expected_active_id THEN
    -- Une autre bascule est passée avant nous (ou plus d'active) : pas de bascule.
    -- Les périodes planifiées n'existent pas : leur id est remplacé par NULL.
    -- Les lignes générées (p_generated) ne sont pas écrites : celles du gagnant existent déjà.
    SELECT array_agg((s #>> '{opened,id}')::uuid) || p_expected_active_id
    INTO v_planned
    FROM jsonb_array_elements(p_switches) AS s;

    PERFORM public.upsert_transactions((
      SELECT COALESCE(jsonb_agg(
        CASE WHEN (t->>'period_id') IS NOT NULL AND (t->>'period_id')::uuid = ANY (v_planned)
             THEN jsonb_set(t, '{period_id}', 'null'::jsonb)
             ELSE t END), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(p_transactions, '[]'::jsonb)) AS t
    ));
    RETURN jsonb_build_object('switched', false, 'reason', 'concurrent', 'removed', 0);
  END IF;

  -- 2. Clôture, puis ouverture (une seule active à la fois), dans l'ordre des dates.
  FOR v_switch IN SELECT * FROM jsonb_array_elements(p_switches) LOOP
    -- Mémoire de bascule : la fin qu'avait la période close AVANT cette clôture. Le back
    -- la transmet (`closed_prev_end`, éventuellement null) ; clé absente (ancien back) :
    -- lue ici, avant l'UPDATE. Clé absente et valeur null sont deux cas différents.
    IF v_switch ? 'closed_prev_end' THEN
      v_prev_end := (v_switch->>'closed_prev_end')::date;
    ELSE
      SELECT end_date INTO v_prev_end
      FROM public.periods
      WHERE id = (v_switch->>'closed_id')::uuid
        AND account_id = p_account_id;
    END IF;

    UPDATE public.periods
    SET end_date = (v_switch->>'close_end')::date, is_active = FALSE
    WHERE id = (v_switch->>'closed_id')::uuid
      AND account_id = p_account_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    -- Un membre en lecture seule voit la période mais l'UPDATE ne touche rien.
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'not allowed to close this period' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.periods (id, account_id, start_date, end_date, is_active, created_at, updated_at,
                                opened_by_trigger, closed_period_id, closed_period_end)
    SELECT p.id, p.account_id, p.start_date, p.end_date, TRUE, p.created_at, p.updated_at,
           TRUE, (v_switch->>'closed_id')::uuid, v_prev_end
    FROM jsonb_to_record(v_switch->'opened') AS p(
      id uuid, account_id uuid, start_date date, end_date date,
      created_at timestamptz, updated_at timestamptz
    );

    -- UNIQUE(period_id, category_id) : un doublon lève 23505 et annule tout.
    INSERT INTO public.budget_instances (id, period_id, category_id, amount_allocated, created_at, updated_at)
    SELECT b.id, b.period_id, b.category_id, b.amount_allocated, b.created_at, b.updated_at
    FROM jsonb_to_recordset(COALESCE(v_switch->'budgets', '[]'::jsonb)) AS b(
      id uuid, period_id uuid, category_id uuid, amount_allocated bigint,
      created_at timestamptz, updated_at timestamptz
    );
  END LOOP;

  -- 3. Les transactions de la requête, puis celles générées par la bascule
  -- (récurrentes injectées, prochaine paie).
  PERFORM public.upsert_transactions(
    COALESCE(p_transactions, '[]'::jsonb) || COALESCE(p_generated, '[]'::jsonb));

  -- 4. Rattachement : toute transaction du compte datée à partir du début d'une période
  -- ouverte lui appartient (period_id n'est rempli qu'à l'insertion, avec l'active).
  -- Dans l'ordre : la période suivante reprend ce qui la concerne.
  FOR v_switch IN SELECT * FROM jsonb_array_elements(p_switches) LOOP
    UPDATE public.transactions
    SET period_id = (v_switch #>> '{opened,id}')::uuid
    WHERE account_id = p_account_id
      AND date >= (v_switch #>> '{opened,start_date}')::date
      AND period_id IS DISTINCT FROM (v_switch #>> '{opened,id}')::uuid;
  END LOOP;

  -- 5. Nettoyage de l'import : les `pending` récurrentes dont l'équivalent est importé.
  -- Filtré par compte et `pending` encore vrai (RLS de l'appelant en plus).
  IF COALESCE(array_length(p_remove_pending_ids, 1), 0) > 0 THEN
    DELETE FROM public.transactions
    WHERE account_id = p_account_id
      AND pending
      AND id = ANY (p_remove_pending_ids);
    GET DIAGNOSTICS v_removed = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('switched', true, 'removed', v_removed);
END;
$function$
;

-- 3e. period_deletion_plan
CREATE OR REPLACE FUNCTION public.period_deletion_plan(p_period_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  d public.periods%ROWTYPE;
  x public.periods%ROWTYPE;
  v_removed integer;
  v_total integer;
  v_reopen boolean := false;
BEGIN
  SELECT * INTO d FROM public.periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) FILTER (WHERE pending IS TRUE AND metadata->>'source' = 'recurring'), count(*)
  INTO v_removed, v_total
  FROM public.transactions
  WHERE account_id = d.account_id AND period_id = d.id;

  -- Réouverture : D active et dernière du compte (même règle que hasNewerPeriod), la période close
  -- existe encore, est inactive et sera la dernière une fois D retirée (sinon 409 par chevauchement).
  IF d.is_active
     AND d.closed_period_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.periods p WHERE p.account_id = d.account_id AND p.start_date > d.start_date)
  THEN
    SELECT * INTO x FROM public.periods WHERE id = d.closed_period_id AND account_id = d.account_id;
    IF FOUND
       AND NOT x.is_active
       AND NOT EXISTS (
         SELECT 1 FROM public.periods p
         WHERE p.account_id = d.account_id AND p.id <> d.id AND p.start_date > x.start_date)
    THEN
      v_reopen := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'removedPending', v_removed,
    'keptTransactions', v_total - v_removed,
    'reopenId', CASE WHEN v_reopen THEN x.id END,
    'reopenStart', CASE WHEN v_reopen THEN x.start_date END,
    'reopenEnd', CASE WHEN v_reopen THEN d.closed_period_end END,
    'origin', CASE WHEN d.opened_by_trigger THEN 'trigger' ELSE 'manual' END
  );
END;
$function$
;

-- 3f. delete_period_clean
CREATE OR REPLACE FUNCTION public.delete_period_clean(p_period_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  d public.periods%ROWTYPE;
  v_plan jsonb;
  v_reopen_id uuid;
  v_removed integer;
  v_kept integer;
  v_count integer;
BEGIN
  -- 1. Existence sans verrou : invisible ou inconnue => 404. Puis verrou : la RLS UPDATE masque la ligne
  -- à un lecteur, le verrou ne rend rien => 403 (c'est pourquoi on lit d'abord sans verrou). Si la ligne a
  -- disparu pendant l'attente du verrou (suppression concurrente), on relit : 404 et non 403.
  PERFORM 1 FROM public.periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO d FROM public.periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM 1 FROM public.periods WHERE id = p_period_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'period not found' USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'not allowed to delete this period' USING ERRCODE = '42501';
  END IF;
  IF d.closed_period_id IS NOT NULL THEN
    PERFORM 1 FROM public.periods WHERE id = d.closed_period_id FOR UPDATE;
  END IF;

  -- 2. Plan relu après les verrous (instruction séparée : voit ce qui s'est validé pendant l'attente).
  v_plan := public.period_deletion_plan(p_period_id);
  v_reopen_id := (v_plan->>'reopenId')::uuid;

  -- 3. Les `pending` récurrentes de D. Le filtre `pending` est réévalué ici : une ligne pointée entre-temps reste.
  DELETE FROM public.transactions
  WHERE account_id = d.account_id
    AND period_id = d.id
    AND pending IS TRUE
    AND metadata->>'source' = 'recurring';
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- 4. Les conservées : rattachées à la période rouverte (avant la suppression, sinon ON DELETE SET NULL
  -- les perdrait), sinon laissées à ON DELETE SET NULL (sans période).
  SELECT count(*) INTO v_kept
  FROM public.transactions
  WHERE account_id = d.account_id AND period_id = d.id;
  IF v_reopen_id IS NOT NULL THEN
    UPDATE public.transactions
    SET period_id = v_reopen_id
    WHERE account_id = d.account_id AND period_id = d.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> v_kept THEN
      RAISE EXCEPTION 'not allowed to move the kept transactions' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 5. La période (budgets en cascade).
  DELETE FROM public.periods WHERE id = d.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'not allowed to delete this period' USING ERRCODE = '42501';
  END IF;

  -- 6. Réouverture, après la suppression : une seule active et pas de chevauchement tiennent à chaque instant.
  IF v_reopen_id IS NOT NULL THEN
    UPDATE public.periods
    SET is_active = TRUE, end_date = d.closed_period_end
    WHERE id = v_reopen_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'not allowed to reopen the previous period' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'removedPending', v_removed,
    'keptTransactions', v_kept,
    'reopenedPeriodId', v_reopen_id,
    'origin', v_plan->>'origin'
  );
END;
$function$
;

-- 3g. get_category_historical_stats
CREATE OR REPLACE FUNCTION public.get_category_historical_stats(p_account_id uuid)
 RETURNS TABLE(category_id uuid, min_real numeric, max_real numeric, avg_real numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
      history.category_id,
      MIN(history.total_amount)::NUMERIC as min_real,
      MAX(history.total_amount)::NUMERIC as max_real,
      AVG(history.total_amount)::NUMERIC as avg_real
    FROM (
      SELECT t.category_id, t.period_id, SUM(t.amount) as total_amount
      FROM public.transactions t
      WHERE t.account_id = p_account_id
      AND t.category_id IS NOT NULL
      AND t.period_id IS NOT NULL
      GROUP BY t.category_id, t.period_id
    ) as history
    GROUP BY history.category_id;
END;
$function$
;

-- 4. Le helper de la nouvelle règle n'existe plus (plus aucune fonction ne l'appelle après 3e et 3g).
DROP FUNCTION IF EXISTS public.period_window_bounds(uuid);

COMMIT;
