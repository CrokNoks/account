-- Cartes de solde du tableau de bord : « Solde en banque », « À venir » et « Revenus / Dépenses »
-- passent en largeur 4 (la carte à deux lignes était trop étroite à 2). Seule la largeur de ces
-- 3 ids change ; ordre, autres widgets, visibilités et ids retirés sont conservés. Idempotent.
-- Test : supabase/tests/widen_balance_cards_test.sql.
-- Retour arrière : remettre "width": 2 sur stat-bank, stat-upcoming, stat-income (même forme d'UPDATE).
CREATE OR REPLACE FUNCTION public.widen_balance_cards(layout jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN layout IS NULL OR jsonb_typeof(layout -> 'widgets') IS DISTINCT FROM 'array' THEN layout
    ELSE jsonb_set(
      layout,
      '{widgets}',
      COALESCE((
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(w) = 'object'
              AND w ->> 'id' IN ('stat-bank', 'stat-upcoming', 'stat-income')
            THEN jsonb_set(w, '{width}', '4'::jsonb)
            ELSE w
          END
          ORDER BY ord
        )
        FROM jsonb_array_elements(layout -> 'widgets') WITH ORDINALITY AS t(w, ord)
      ), '[]'::jsonb)
    )
  END;
$$;

UPDATE public.user_preferences
SET dashboard_layout = public.widen_balance_cards(dashboard_layout)
WHERE public.widen_balance_cards(dashboard_layout) IS DISTINCT FROM dashboard_layout;
