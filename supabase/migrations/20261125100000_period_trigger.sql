-- Déclencheur de période (spec declencheur-periode) : une transaction d'une catégorie
-- choisie (ex. « Salaire ») clôt la période active et en ouvre une nouvelle.
--
-- Purement additif (colonne à false, un index, deux fonctions) : l'ancien code ignore
-- tout cela, le nouveau code sans la migration lit « aucune catégorie déclencheuse »
-- (aucune bascule, aucune erreur). Les deux ordres de déploiement sont sûrs.
--
-- Retour arrière : retirer la marque suffit à tout éteindre sans déploiement ; sinon
--   DROP FUNCTION public.apply_period_switches(uuid, uuid, jsonb, jsonb, jsonb, uuid[], boolean);
--   DROP FUNCTION public.set_period_trigger_category(uuid, boolean);
--   DROP INDEX public.categories_one_period_trigger_per_account;
--   ALTER TABLE public.categories DROP COLUMN is_period_trigger;

-- 1. Réglage : au plus une catégorie déclencheuse par compte, aucune par défaut.
ALTER TABLE public.categories
  ADD COLUMN is_period_trigger boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX categories_one_period_trigger_per_account
  ON public.categories (account_id)
  WHERE is_period_trigger;

-- Marque (ou retire la marque de) une catégorie ; en marquer une autre retire la
-- première, dans la même transaction (sinon l'index unique refuse).
-- SECURITY INVOKER : la RLS des catégories s'applique. Une catégorie d'un autre compte
-- (ou globale) est invisible : P0002 (404). Un membre en lecture seule la voit mais ses
-- UPDATE ne touchent rien : on le détecte par ROW_COUNT (42501, 403).
CREATE OR REPLACE FUNCTION public.set_period_trigger_category(
  p_category_id uuid,
  p_value boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account_id uuid;
  v_count integer;
BEGIN
  SELECT account_id INTO v_account_id
  FROM public.categories
  WHERE id = p_category_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'category not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_value THEN
    UPDATE public.categories
    SET is_period_trigger = FALSE
    WHERE account_id = v_account_id
      AND is_period_trigger
      AND id <> p_category_id;
  END IF;

  UPDATE public.categories
  SET is_period_trigger = p_value
  WHERE id = p_category_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'not allowed to modify this category' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_period_trigger_category(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_period_trigger_category(uuid, boolean) TO authenticated;

-- 2. Bascule atomique : clôture de l'active, ouverture de la nouvelle (budgets compris),
-- écriture des transactions (déclencheuse, récurrentes injectées, prochaine paie) et
-- rattachement des transactions déjà saisies, en UNE transaction. Toute erreur annule tout.
--
-- SECURITY INVOKER (RLS de l'appelant, comme create_period_with_budgets).
--
-- Concurrence : le verrou de ligne sur la période active sérialise les déclenchements
-- simultanés. Le second attend la fin du premier, ne retrouve plus d'active (ou une autre
-- que celle qu'il attendait) : il n'y a pas de bascule, ses lignes sont enregistrées
-- telles quelles (période NULL : le trigger assign_period_id les rattache à l'active),
-- SANS les lignes générées (p_generated : récurrentes injectées, prochaine paie), que seule
-- la bascule réussie écrit (sinon double compte avec celles du gagnant), et le retour dit `{"switched": false, "reason": "concurrent"}`.
--
-- p_expected_active_id : l'active lue par l'appelant avant de planifier.
-- p_switches : [{ closed_id, close_end, opened: { id, account_id, start_date, end_date,
--               created_at, updated_at }, budgets: [{ id, period_id, category_id,
--               amount_allocated, created_at, updated_at }] }], dans l'ordre des dates.
-- p_transactions : les lignes de la requête, même forme que public.upsert_transactions
--               (period_id déjà choisi par l'appelant pour les périodes planifiées).
-- p_generated : les lignes créées par la bascule (récurrentes injectées, prochaine paie),
--               même forme ; écrites seulement si la bascule a lieu.
-- p_remove_pending_ids : nettoyage de l'import. Transactions du compte à supprimer, seulement
--               si la bascule a lieu et si elles sont encore `pending` (jamais une ligne
--               pointée entre-temps). Même transaction : toute erreur annule tout.
-- p_update : mode modification (PATCH, lot). Les lignes de p_transactions doivent exister :
--               verrou de ligne (FOR UPDATE, qui bloque une suppression concurrente) puis
--               vérification, dans les deux branches (bascule et concurrent). Une ligne
--               disparue lève P0002 (404, comme update_transactions) et rien n'est écrit.
--               Faux (création, import) : les lignes sont nouvelles, aucune vérification.
-- Retour : { "switched": true, "removed": n } ou { "switched": false, "reason": "concurrent",
--          "removed": 0 }.
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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_id uuid;
  v_switch jsonb;
  v_count integer;
  v_planned uuid[];
  v_removed integer := 0;
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
    UPDATE public.periods
    SET end_date = (v_switch->>'close_end')::date, is_active = FALSE
    WHERE id = (v_switch->>'closed_id')::uuid
      AND account_id = p_account_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    -- Un membre en lecture seule voit la période mais l'UPDATE ne touche rien.
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'not allowed to close this period' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.periods (id, account_id, start_date, end_date, is_active, created_at, updated_at)
    SELECT p.id, p.account_id, p.start_date, p.end_date, TRUE, p.created_at, p.updated_at
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
$$;

REVOKE ALL ON FUNCTION public.apply_period_switches(uuid, uuid, jsonb, jsonb, jsonb, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_period_switches(uuid, uuid, jsonb, jsonb, jsonb, uuid[], boolean) TO authenticated;
