-- Les fonctions utilitaires ne doivent pas être appelables en RPC (anon / authenticated).
-- Lancement : psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/utility_functions_privileges_test.sql
DO $$
DECLARE
  fn text;
  r text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.widen_balance_cards(jsonb)',
    'public.repair_mojibake(text)',
    'public.repair_lost_accents(text)'
  ] LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      ASSERT NOT has_function_privilege(r, fn, 'EXECUTE'), r || ' ne doit pas pouvoir exécuter ' || fn;
    END LOOP;
  END LOOP;
END $$;
