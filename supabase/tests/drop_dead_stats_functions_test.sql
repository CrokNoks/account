-- Fonctions mortes supprimées : get_balance_history, get_evolution_data (2 signatures) lisaient la table
-- « expenses », qui n'existe plus ; get_category_historical_stats reste en place et s'exécute.
-- Lancement (Supabase local uniquement) : npm run test:sql
BEGIN;

DO $$
BEGIN
  ASSERT to_regprocedure('public.get_balance_history(uuid, date)') IS NULL, 'get_balance_history(uuid, date) existe encore';
  ASSERT to_regprocedure('public.get_evolution_data(uuid)') IS NULL, 'get_evolution_data(uuid) existe encore';
  ASSERT to_regprocedure('public.get_evolution_data(uuid, text)') IS NULL, 'get_evolution_data(uuid, text) existe encore';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public' AND p.proname IN ('get_balance_history', 'get_evolution_data')),
    'une surcharge de get_balance_history / get_evolution_data subsiste';
  -- la fonction de statistiques conservée : search_path figé et exécutable
  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.get_category_historical_stats(uuid)'::regprocedure
                 AND proconfig IS NOT NULL AND 'search_path=public, pg_temp' = ANY (proconfig)),
    'get_category_historical_stats : search_path non figé';
  PERFORM * FROM public.get_category_historical_stats('bbbbbbbb-0000-4000-8000-0000000000f1');
END $$;

ROLLBACK;
