-- Réparation des libellés dont l'accent a été perdu (« � », U+FFFD) par d'anciens imports CSV.
-- Lancement : psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/repair_lost_accents_test.sql
DO $$
DECLARE
  x CONSTANT text := chr(65533);
BEGIN
  -- réparés (mots entiers connus)
  ASSERT public.repair_lost_accents('Pr' || x || 'l' || x || 'vement') = 'Prélèvement', 'Prélèvement';
  ASSERT public.repair_lost_accents('Pr' || x || 'l' || x || 'vement' || chr(10) || 'Offre Compte ' || x || ' composer')
    = 'Prélèvement' || chr(10) || 'Offre Compte à composer', 'à seul, plusieurs mots';
  ASSERT public.repair_lost_accents('Cr' || x || 'dit Agricole - Cr' || x || 'dit') = 'Crédit Agricole - Crédit', 'plusieurs fois';
  ASSERT public.repair_lost_accents('Remboursement pr' || x || 't') = 'Remboursement prêt', 'prêt';
  ASSERT public.repair_lost_accents('Direction G' || x || 'n' || x || 'rale') = 'Direction Générale', 'Générale';
  ASSERT public.repair_lost_accents('R' || x || 'glement') = 'Règlement', 'Règlement';
  ASSERT public.repair_lost_accents('Int' || x || 'rets d' || x || 'biteurs') = 'Intérets débiteurs', 'Intérets débiteurs';
  ASSERT public.repair_lost_accents('Franchise int' || x || 'rets') = 'Franchise intérets', 'intérets';
  ASSERT public.repair_lost_accents('08/08 - Intermarch' || x) = '08/08 - Intermarché', 'Intermarché';
  ASSERT public.repair_lost_accents('Ch' || x || 'que') = 'Chèque', 'Chèque';
  ASSERT public.repair_lost_accents('Virement ' || x || 'mis') = 'Virement émis', 'émis';
  ASSERT public.repair_lost_accents('Caisse R' || x || 'gionale') = 'Caisse Régionale', 'Régionale';
  -- laissés tels quels
  ASSERT public.repair_lost_accents('CARREFOUR') = 'CARREFOUR', 'sans caractère perdu';
  ASSERT public.repair_lost_accents('Caf' || x || ' du coin') = 'Caf' || x || ' du coin', 'mot inconnu';
  ASSERT public.repair_lost_accents('XCr' || x || 'dit') = 'XCr' || x || 'dit', 'pas un mot entier';
END $$;
