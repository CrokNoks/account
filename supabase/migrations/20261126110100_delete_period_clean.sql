-- Suppression propre d'une période (spec suppression-periode-propre, commit 2/2) : la période, ses
-- budgets et ses factures `pending` issues des récurrentes disparaissent en UNE transaction ; si la
-- période a été ouverte par le déclencheur et que la période qu'elle avait close redevient la dernière
-- du compte, celle-ci est rouverte (active, fin d'avant la bascule) et reprend les transactions conservées.
-- Prérequis : 20261126110000_period_switch_memory.sql (colonnes opened_by_trigger, closed_period_*).
--
-- Trois fonctions SECURITY INVOKER (RLS de l'appelant, comme apply_period_switches) :
--   period_deletion_plan(id)    la règle, écrite une seule fois : ce qui sera supprimé / conservé / rouvert
--   preview_delete_period(id)   l'aperçu de l'écran : ce plan, aucune écriture, aucun verrou
--   delete_period_clean(id)     la suppression atomique
--
-- Périmètre exact des suppressions : `pending` vrai ET metadata->>'source' = 'recurring' ET
-- period_id = la période supprimée, du même compte. Jamais une transaction pointée ou saisie.
--
-- Erreurs : P0002 (404) période invisible ou inconnue ; 42501 (403) lecture seule ; 23505 / 23P01
-- (409) filet des index « une seule active » et « pas de chevauchement » (tout est alors annulé).
--
-- Retour arrière : revert du code, puis
--   DROP FUNCTION public.delete_period_clean(uuid);
--   DROP FUNCTION public.preview_delete_period(uuid);
--   DROP FUNCTION public.period_deletion_plan(uuid);
-- (additif : l'ancien DELETE simple sur `periods` continue de fonctionner).

-- Plan : lit seulement. STABLE : appelé tel quel par l'aperçu, et dans delete_period_clean après les
-- verrous (instruction séparée, donc sur ce qui s'est validé pendant l'attente).
-- Retour : { removedPending, keptTransactions, reopenId|null, reopenStart|null, reopenEnd|null, origin }
CREATE OR REPLACE FUNCTION public.period_deletion_plan(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
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
$$;

-- Aperçu : le plan, rien d'autre. Le nombre annoncé n'engage pas la suppression, qui réapplique la règle.
CREATE OR REPLACE FUNCTION public.preview_delete_period(p_period_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT public.period_deletion_plan(p_period_id);
$$;

-- Suppression atomique, dans l'ordre : verrous (D puis la période close), plan relu, suppression des
-- pending récurrentes, rattachement des conservées à la période rouverte, suppression de D (budgets en
-- cascade), réouverture. Toute erreur annule tout.
-- Concurrence : le verrou de ligne sur D sérialise deux suppressions de D et une bascule
-- (apply_period_switches verrouille l'active). Ordre constant : D puis X.
-- Retour : { removedPending, keptTransactions, reopenedPeriodId|null, origin } (nombres RÉELS de cette exécution).
CREATE OR REPLACE FUNCTION public.delete_period_clean(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.period_deletion_plan(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preview_delete_period(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_period_clean(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.period_deletion_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_delete_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_period_clean(uuid) TO authenticated;
