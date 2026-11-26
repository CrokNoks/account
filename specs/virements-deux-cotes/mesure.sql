-- Mesure : virements à deux côtés (lecture seule).
-- Indicateur : désaccordés (montants non opposés ou dates différentes) et orphelins -> 0 après livraison.
-- Usage : psql ... -f specs/virements-deux-cotes/mesure.sql  (base locale : port 54322)
-- Un virement = les lignes partageant metadata->>'transferId'. Montants en centimes.
begin read only;

with sides as (
  select
    metadata->>'transferId' as transfer_id,
    count(*)                as nb_lignes,
    count(*) filter (where metadata->>'type' = 'transfer_out') as nb_sorties,
    count(*) filter (where metadata->>'type' = 'transfer_in')  as nb_entrees,
    sum(amount)             as somme_centimes,
    count(distinct date)    as nb_dates
  from transactions
  where metadata ? 'transferId'
  group by 1
)
select
  count(*)                                                       as virements,
  count(*) filter (where nb_lignes = 1)                          as orphelins,
  count(*) filter (where nb_lignes > 2
                      or (nb_lignes = 2 and (nb_sorties <> 1 or nb_entrees <> 1))) as ambigus,
  count(*) filter (where nb_lignes = 2 and nb_sorties = 1 and nb_entrees = 1
                      and (somme_centimes <> 0 or nb_dates > 1)) as desaccordes
from sides;

rollback;
