-- Libellés de transactions mal encodés par d'anciens imports CSV (UTF-8 relu en Windows-1252 ou
-- Latin-1 : « PRÃ‰LÃˆVEMENT » au lieu de « PRÉLÈVEMENT »). L'import décode correctement depuis
-- (decodeCsv) ; on répare l'existant. Test : supabase/tests/repair_mojibake_test.sql.

-- Ré-encode en Windows-1252 (ou Latin-1) puis relit en UTF-8, jusqu'à 3 fois (double encodage).
-- Ne change rien si le résultat n'est pas de l'UTF-8 valide : texte déjà correct, Â légitime,
-- mélange ambigu, ou caractère perdu (U+FFFD, irréparable).
CREATE OR REPLACE FUNCTION public.repair_mojibake(s text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  cur text := s;
  nxt text;
BEGIN
  FOR i IN 1..3 LOOP
    EXIT WHEN cur IS NULL OR cur !~ '[ÃÂâ]';
    -- « à » mal encodé = « Ã » + espace insécable, souvent devenue une espace normale
    nxt := replace(cur, 'Ã ', 'Ã' || chr(160));
    BEGIN
      nxt := convert_from(convert_to(nxt, 'WIN1252'), 'UTF8');
    EXCEPTION WHEN others THEN
      BEGIN
        nxt := convert_from(convert_to(nxt, 'LATIN1'), 'UTF8');
      EXCEPTION WHEN others THEN
        EXIT;
      END;
    END;
    EXIT WHEN nxt = cur;
    cur := nxt;
  END LOOP;
  RETURN cur;
END;
$$;

-- Retour arrière : UPDATE public.transactions t SET description = b.description
--   FROM public.transactions_description_backup b WHERE b.id = t.id;
CREATE TABLE public.transactions_description_backup (
  id uuid PRIMARY KEY,
  description text NOT NULL,
  repaired_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions_description_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transactions_description_backup FROM anon, authenticated;

INSERT INTO public.transactions_description_backup (id, description)
SELECT id, description
FROM public.transactions
WHERE description ~ '[ÃÂâ]'
  AND public.repair_mojibake(description) <> description;

UPDATE public.transactions t
SET description = public.repair_mojibake(t.description)
FROM public.transactions_description_backup b
WHERE b.id = t.id;
