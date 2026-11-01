-- Réparation des libellés mal encodés (UTF-8 relu en Windows-1252 / Latin-1 par d'anciens imports).
-- Lancement : psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/repair_mojibake_test.sql
DO $$
BEGIN
  -- réparés
  ASSERT public.repair_mojibake('PRÃ‰LÃˆVEMENT') = 'PRÉLÈVEMENT', 'majuscules accentuées';
  ASSERT public.repair_mojibake('CafÃ© crÃ¨me') = 'Café crème', 'minuscules accentuées';
  ASSERT public.repair_mojibake('Paiement Ã  Paris') = 'Paiement à Paris', 'à avec espace normale';
  ASSERT public.repair_mojibake('Paiement Ã' || chr(160) || ' Paris') = 'Paiement à Paris', 'à avec espace insécable';
  ASSERT public.repair_mojibake('NÂ° 12 : 5 â‚¬') = 'N° 12 : 5 €', 'symboles';
  ASSERT public.repair_mojibake('Ã' || chr(137) || 'COLE') = 'ÉCOLE', 'relu en Latin-1 (caractère de contrôle)';
  ASSERT public.repair_mojibake('PRÃƒÂ‰LÃƒÂˆVEMENT') = 'PRÉLÈVEMENT', 'encodé deux fois';
  -- laissés tels quels
  ASSERT public.repair_mojibake('PRÉLÈVEMENT') = 'PRÉLÈVEMENT', 'déjà correct';
  ASSERT public.repair_mojibake('CARREFOUR') = 'CARREFOUR', 'ASCII';
  ASSERT public.repair_mojibake('BÂTIMENT') = 'BÂTIMENT', 'Â légitime';
  ASSERT public.repair_mojibake('Café CafÃ©') = 'Café CafÃ©', 'mélange ambigu : pas de réparation partielle';
  ASSERT public.repair_mojibake('PR' || chr(65533) || 'L') = 'PR' || chr(65533) || 'L', 'caractère perdu : irréparable';
END $$;
