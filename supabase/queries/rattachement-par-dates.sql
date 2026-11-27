-- Mesure d'impact « rattachement par les dates » : somme des transactions comptées par période,
-- ancienne fenêtre contre nouvelle, et liste des périodes dont le total change.
-- À LANCER AVANT la migration (la requête ne lit pas period_id : elle reste valable après, pour comparer).
--   ancienne fenêtre : date >= début ET (pas de fin OU date <= fin OU (période active ET montant < 0)).
--   nouvelle fenêtre : date >= début ET (fermée : pas de fin OU date <= fin ;
--                      active : tout, sauf la prochaine paie = pending de la catégorie déclencheuse,
--                      avec recurringId, datée strictement après la fin).
-- Attendu : seules changent les périodes actives avec un revenu (montant >= 0) daté après leur fin, et les
-- périodes fermées sans fin ; ecart_centimes = nouveau - ancien, hors solde de départ.
-- ATTENTION : reproduit la règle en SQL (le prévu réel est calculé par le back) ; ce n'est pas le prévu complet,
-- seulement le total des lignes de la fenêtre, donc l'écart de périmètre.
-- Lecture seule. Montants en centimes.
-- Lancement local : docker exec -i supabase_db_account-v2 psql -U postgres < supabase/queries/rattachement-par-dates.sql
-- Lancement distant : PGOPTIONS='-c default_transaction_read_only=on' psql "<url>" -f supabase/queries/rattachement-par-dates.sql
WITH lignes AS (
  SELECT p.id AS period_id,
         t.amount,
         (t.date >= p.start_date
          AND (p.end_date IS NULL
               OR t.date <= p.end_date
               OR (p.is_active AND t.amount < 0))) AS dans_ancienne,
         (t.date >= p.start_date
          AND CASE
                WHEN p.is_active THEN NOT (
                  p.end_date IS NOT NULL
                  AND t.pending IS TRUE
                  AND t.date > p.end_date
                  AND coalesce(t.metadata->>'recurringId', '') <> ''
                  AND EXISTS (SELECT 1 FROM public.categories c
                              WHERE c.id = t.category_id AND c.is_period_trigger))
                ELSE (p.end_date IS NULL OR t.date <= p.end_date)
              END) AS dans_nouvelle
  FROM public.periods p
  JOIN public.transactions t ON t.account_id = p.account_id AND t.date >= p.start_date
),
par_periode AS (
  SELECT p.account_id, p.start_date, p.end_date, p.is_active,
         coalesce(sum(l.amount) FILTER (WHERE l.dans_ancienne), 0) AS total_ancien_centimes,
         coalesce(sum(l.amount) FILTER (WHERE l.dans_nouvelle), 0) AS total_nouveau_centimes,
         count(*) FILTER (WHERE l.dans_nouvelle AND NOT l.dans_ancienne) AS lignes_ajoutees,
         count(*) FILTER (WHERE l.dans_ancienne AND NOT l.dans_nouvelle) AS lignes_retirees
  FROM public.periods p
  LEFT JOIN lignes l ON l.period_id = p.id
  GROUP BY p.id, p.account_id, p.start_date, p.end_date, p.is_active
)
-- Une ligne par période dont le total change ; periodes_total et part_pct portent sur toutes les périodes.
SELECT account_id, start_date, end_date, is_active,
       total_ancien_centimes,
       total_nouveau_centimes,
       total_nouveau_centimes - total_ancien_centimes AS ecart_centimes,
       lignes_ajoutees,
       lignes_retirees,
       periodes_total,
       periodes_qui_changent,
       round(100.0 * periodes_qui_changent / nullif(periodes_total, 0), 1) AS part_pct
FROM (
  SELECT *,
         count(*) OVER () AS periodes_total,
         count(*) FILTER (WHERE total_nouveau_centimes <> total_ancien_centimes
                            OR lignes_ajoutees <> 0 OR lignes_retirees <> 0) OVER () AS periodes_qui_changent
  FROM par_periode
) x
WHERE total_nouveau_centimes <> total_ancien_centimes OR lignes_ajoutees <> 0 OR lignes_retirees <> 0
ORDER BY account_id, start_date DESC;
