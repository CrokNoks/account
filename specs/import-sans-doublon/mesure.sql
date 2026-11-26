-- Lecture seule. Lignes importées en double depuis la mise en prod.
-- Paramètre obligatoire, à renseigner au moment de la mesure (sans valeur par défaut, psql refuse s'il manque) :
--   psql "$URL" -v mise_en_prod='AAAA-MM-JJ HH:MM+00' -f specs/import-sans-doublon/mesure.sql
-- Groupes (compte, date, montant, libellé minuscule sans accents/espaces multiples) de plus d'une ligne
-- dont au moins une a été créée après la mise en prod. Départ (2026-11-26, stock) : 39 groupes / 61 lignes en trop.
-- Suit la tendance, pas zéro : des achats identiques réels restent comptés.
-- Accents retirés par translate (l'extension unaccent n'est pas installée).
-- Exécutée dans une transaction en lecture seule : toute écriture serait refusée par la base.
begin read only;
select count(*) as groupes, coalesce(sum(n - 1), 0) as lignes_en_trop
from (
  select count(*) as n
  from public.transactions
  where pending is not true
  group by account_id, date, amount,
           translate(lower(regexp_replace(btrim(description), '\s+', ' ', 'g')),
                     'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc')
  having count(*) > 1
     and max(created_at) >= (:'mise_en_prod')::timestamptz
) g;
rollback;
