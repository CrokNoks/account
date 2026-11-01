-- Libellés de transactions dont l'accent a été perdu par d'anciens imports CSV : l'octet
-- Windows-1252 a été remplacé par « � » (U+FFFD), irréversible (« Pr�l�vement »). La réparation
-- précédente (repair_mojibake) ne les touchait pas. On remplace les mots entiers relevés en prod
-- le 2026-11-01 ; un mot absent de la liste reste tel quel. Test : supabase/tests/repair_lost_accents_test.sql.
CREATE OR REPLACE FUNCTION public.repair_lost_accents(s text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  x CONSTANT text := chr(65533);
  r text[];
  cur text := s;
BEGIN
  IF cur IS NULL OR position(x IN cur) = 0 THEN
    RETURN cur;
  END IF;
  -- Mots d'abord ; « � » seul (« Compte à composer ») en dernier.
  FOREACH r SLICE 1 IN ARRAY ARRAY[
    ['Pr?l?vement', 'Prélèvement'],
    ['Cr?dit', 'Crédit'],
    ['pr?t', 'prêt'],
    ['G?n?rale', 'Générale'],
    ['R?glement', 'Règlement'],
    ['d?biteurs', 'débiteurs'],
    ['Intermarch?', 'Intermarché'],
    ['int?rets', 'intérets'],
    ['Int?rets', 'Intérets'],
    ['Ch?que', 'Chèque'],
    ['?mis', 'émis'],
    ['R?gionale', 'Régionale'],
    ['?', 'à']
  ] LOOP
    cur := regexp_replace(
      cur,
      '(?<![[:alnum:]])' || replace(r[1], '?', x) || '(?![[:alnum:]])',
      r[2],
      'g'
    );
  END LOOP;
  RETURN cur;
END;
$$;

-- Retour arrière : voir 20261101100200 (même table de sauvegarde).
INSERT INTO public.transactions_description_backup (id, description)
SELECT id, description
FROM public.transactions
WHERE position(chr(65533) IN description) > 0
  AND public.repair_lost_accents(description) <> description
ON CONFLICT (id) DO NOTHING;

UPDATE public.transactions
SET description = public.repair_lost_accents(description)
WHERE position(chr(65533) IN description) > 0
  AND public.repair_lost_accents(description) <> description;
