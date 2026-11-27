-- Rattachement des transactions à la période par les dates seulement (spec rattachement-par-dates).
-- `transactions.period_id` disparaît : une transaction appartient à la période dont la fenêtre contient sa date
-- (fermée : [début, fin] ; active : à partir du début, la prochaine paie exclue côté back). Plus de trigger
-- d'attribution, plus de rattachement à la bascule, plus de déplacement à la suppression.
--
-- Ce que fait la migration, dans l'ordre :
--   1. retire le trigger set_transactions_period_id et assign_period_id ;
--   2. period_window_bounds(période) : LE helper de la fenêtre de suppression (une seule règle, SQL) ;
--   3. réécrit sans period_id : insert_transactions, upsert_transactions (donc les créations de période,
--      de virement, d'import et de modification en lot qui les appellent), apply_period_switches,
--      period_deletion_plan, delete_period_clean, get_category_historical_stats ;
--   4. DROP COLUMN transactions.period_id (la FK et l'index idx_transactions_period_id partent avec).
-- Les fonctions gardent leur search_path fixé (20261127100000) et leurs droits (CREATE OR REPLACE).
--
-- Retour arrière : supabase/queries/rattachement-par-dates-retour.sql (la colonne est supprimée, un simple
-- revert ne suffit plus). Rien n'est perdu : period_id se déduit des dates.

-- 1. Plus d'attribution à l'insertion.
DROP TRIGGER IF EXISTS set_transactions_period_id ON public.transactions;
DROP FUNCTION IF EXISTS public.assign_period_id();

-- 2. Fenêtre de suppression d'une période (lo, hi), bornes incluses. hi NULL = pas de borne haute.
--   active : pas de borne haute (sa fin n'est qu'indicative ; la prochaine paie, datée après, part avec elle) ;
--   fermée : sa fin ; fermée SANS fin : la veille du début de la période suivante du compte (NULL s'il n'y en a pas) :
--   une suppression est destructive, une fermée sans fin n'avale jamais les périodes suivantes.
-- SECURITY INVOKER : la RLS de l'appelant s'applique (une période invisible ne rend aucune ligne).
CREATE OR REPLACE FUNCTION public.period_window_bounds(p_period_id uuid)
RETURNS TABLE (lo date, hi date)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p.start_date,
         CASE
           WHEN p.is_active THEN NULL
           WHEN p.end_date IS NOT NULL THEN p.end_date
           ELSE (SELECT min(n.start_date) - 1
                 FROM public.periods n
                 WHERE n.account_id = p.account_id AND n.start_date > p.start_date)
         END
  FROM public.periods p
  WHERE p.id = p_period_id;
$$;

REVOKE ALL ON FUNCTION public.period_window_bounds(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.period_window_bounds(uuid) TO authenticated;

-- 3a. Insertion et upsert en lot : plus de period_id (une clé period_id envoyée par un ancien back est ignorée).
CREATE OR REPLACE FUNCTION public.insert_transactions(p_transactions jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_transactions IS NULL OR jsonb_typeof(p_transactions) <> 'array' THEN
    RAISE EXCEPTION 'p_transactions must be a JSON array' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transactions (
    id, account_id, category_id, date, description, amount,
    reconciled, pending, notes, metadata,
    created_at, updated_at
  )
  SELECT
    t.id, t.account_id, t.category_id, t.date, t.description, t.amount,
    t.reconciled, t.pending, t.notes, COALESCE(t.metadata, '{}'::jsonb),
    t.created_at, t.updated_at
  FROM jsonb_to_recordset(p_transactions) AS t(
    id uuid, account_id uuid, category_id uuid, date date,
    description text, amount bigint, reconciled boolean, pending boolean,
    notes text, metadata jsonb,
    created_at timestamptz, updated_at timestamptz
  );

  INSERT INTO public.transaction_tags (transaction_id, tag_id)
  SELECT DISTINCT t.id, tag.tag_id::uuid
  FROM jsonb_to_recordset(p_transactions) AS t(id uuid, tag_ids jsonb),
       LATERAL jsonb_array_elements_text(COALESCE(t.tag_ids, '[]'::jsonb)) AS tag(tag_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_transactions(p_transactions jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_transactions IS NULL OR jsonb_typeof(p_transactions) <> 'array' THEN
    RAISE EXCEPTION 'p_transactions must be a JSON array' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transactions (
    id, account_id, category_id, date, description, amount,
    reconciled, pending, notes, metadata,
    created_at, updated_at
  )
  SELECT
    t.id, t.account_id, t.category_id, t.date, t.description, t.amount,
    t.reconciled, t.pending, t.notes, COALESCE(t.metadata, '{}'::jsonb),
    t.created_at, t.updated_at
  FROM jsonb_to_recordset(p_transactions) AS t(
    id uuid, account_id uuid, category_id uuid, date date,
    description text, amount bigint, reconciled boolean, pending boolean,
    notes text, metadata jsonb,
    created_at timestamptz, updated_at timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    account_id = EXCLUDED.account_id,
    category_id = EXCLUDED.category_id,
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
$$;

-- 3b. Bascule : plus de rattachement (ancienne étape 4) ni de remplacement des period_id « planifiés » dans la
-- branche concurrente. Le reste est inchangé (verrous, mémoire de bascule, un seul actif, budgets, nettoyage d'import).
CREATE OR REPLACE FUNCTION public.apply_period_switches(
  p_account_id uuid,
  p_expected_active_id uuid,
  p_switches jsonb,
  p_transactions jsonb DEFAULT '[]'::jsonb,
  p_generated jsonb DEFAULT '[]'::jsonb,
  p_remove_pending_ids uuid[] DEFAULT '{}'::uuid[],
  p_update boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_id uuid;
  v_switch jsonb;
  v_count integer;
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
    -- Les lignes générées (p_generated) ne sont pas écrites : celles du gagnant existent déjà.
    PERFORM public.upsert_transactions(COALESCE(p_transactions, '[]'::jsonb));
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
  -- (récurrentes injectées, prochaine paie). Aucun rattachement : les dates suffisent.
  PERFORM public.upsert_transactions(
    COALESCE(p_transactions, '[]'::jsonb) || COALESCE(p_generated, '[]'::jsonb));

  -- 4. Nettoyage de l'import : les `pending` récurrentes dont l'équivalent est importé.
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
$$;

-- 3c. Plan de suppression : la fenêtre vient de period_window_bounds, la même règle que la suppression.
-- Retour : { removedPending, keptTransactions, reopenId|null, reopenStart|null, reopenEnd|null, origin }
CREATE OR REPLACE FUNCTION public.period_deletion_plan(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  d public.periods%ROWTYPE;
  x public.periods%ROWTYPE;
  v_lo date;
  v_hi date;
  v_removed integer;
  v_total integer;
  v_reopen boolean := false;
BEGIN
  SELECT * INTO d FROM public.periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT b.lo, b.hi INTO v_lo, v_hi FROM public.period_window_bounds(d.id) b;

  -- Même prédicat de fenêtre que delete_period_clean (compte, date >= lo, date <= hi).
  SELECT count(*) FILTER (WHERE pending IS TRUE AND metadata->>'source' = 'recurring'), count(*)
  INTO v_removed, v_total
  FROM public.transactions
  WHERE account_id = d.account_id AND date >= v_lo AND (v_hi IS NULL OR date <= v_hi);

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
$$;

-- 3d. Suppression : les `pending` récurrentes de la fenêtre de D (par les dates) ; les conservées ne bougent
-- plus (elles apparaissent dans la période rouverte par leurs dates). Verrous D puis X, réouverture : inchangés.
CREATE OR REPLACE FUNCTION public.delete_period_clean(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  d public.periods%ROWTYPE;
  v_plan jsonb;
  v_reopen_id uuid;
  v_lo date;
  v_hi date;
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
  SELECT b.lo, b.hi INTO v_lo, v_hi FROM public.period_window_bounds(d.id) b;

  -- 3. Les `pending` récurrentes de la fenêtre de D. Le filtre `pending` est réévalué ici : une ligne
  -- pointée entre-temps reste. Même prédicat de fenêtre que le plan.
  DELETE FROM public.transactions
  WHERE account_id = d.account_id
    AND date >= v_lo AND (v_hi IS NULL OR date <= v_hi)
    AND pending IS TRUE
    AND metadata->>'source' = 'recurring';
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- 4. Les conservées de la fenêtre : aucune écriture (rattachement par les dates).
  SELECT count(*) INTO v_kept
  FROM public.transactions
  WHERE account_id = d.account_id AND date >= v_lo AND (v_hi IS NULL OR date <= v_hi);

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
$$;

-- 3e. Historique des réels par catégorie et par période (module budgets) : la période d'une transaction
-- se déduit de sa date (fenêtre de period_window_bounds), plus de period_id.
CREATE OR REPLACE FUNCTION public.get_category_historical_stats(p_account_id uuid)
RETURNS TABLE(category_id uuid, min_real numeric, max_real numeric, avg_real numeric)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT
      history.category_id,
      MIN(history.total_amount)::NUMERIC as min_real,
      MAX(history.total_amount)::NUMERIC as max_real,
      AVG(history.total_amount)::NUMERIC as avg_real
    FROM (
      SELECT t.category_id, p.id AS period_id, SUM(t.amount) as total_amount
      FROM public.transactions t
      JOIN public.periods p ON p.account_id = t.account_id
      CROSS JOIN LATERAL public.period_window_bounds(p.id) b
      WHERE t.account_id = p_account_id
      AND t.category_id IS NOT NULL
      AND t.date >= b.lo AND (b.hi IS NULL OR t.date <= b.hi)
      GROUP BY t.category_id, p.id
    ) as history
    GROUP BY history.category_id;
END;
$$;

-- 4. La colonne (FK vers periods et index idx_transactions_period_id partent avec).
ALTER TABLE public.transactions DROP COLUMN period_id;
