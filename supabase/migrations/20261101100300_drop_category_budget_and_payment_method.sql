-- Retire trois éléments inutilisés (specs/suppression-champs-inutiles) : le plafond de
-- catégorie (categories.budget, le budget est celui de la période) et le moyen de paiement
-- (transactions.payment_method, jamais saisi ni affiché).
-- À appliquer APRÈS le déploiement du back qui n'écrit plus ces colonnes.
-- Ordre : fonctions d'abord (les corps plpgsql ne sont pas suivis par les dépendances), puis colonnes.
-- SECURITY INVOKER (explicite) comme à l'origine : la RLS de l'appelant s'applique.

-- 1. Fonctions d'écriture sans payment_method (corps identiques sinon)
CREATE OR REPLACE FUNCTION public.insert_transactions(p_transactions jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
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
$function$;

CREATE OR REPLACE FUNCTION public.upsert_transactions(p_transactions jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
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
$function$;

-- 2. Colonnes (la contrainte CHECK de payment_method part avec elle)
ALTER TABLE public.transactions DROP COLUMN payment_method;
ALTER TABLE public.categories DROP COLUMN budget;
