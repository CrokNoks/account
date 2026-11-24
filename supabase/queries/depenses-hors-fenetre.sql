-- Mesure d'impact « factures réservées » : dépenses (montant < 0) datées après la fin d'une période active.
-- Indicateur : cible 0 opération « absente du prévu » ; ici on dénombre celles qui existent, par période active.
-- ATTENTION : cette requête ne prouve PAS que le prévu les compte (le prévu est calculé par le back, pas en SQL).
-- Elle donne seulement le périmètre concerné. Preuve de la prise en compte : tests de period-window et dépense
-- de contrôle vue dans le prévu en recette. Après livraison, comparer ce nombre au « réel » des stats de la période.
-- Lecture seule. Montants en centimes. Les périodes sans fin (end_date null) n'ont pas de « après la fin » : exclues.
-- Lancement (recette uniquement) : PGOPTIONS='-c default_transaction_read_only=on' psql "<url recette>" -f supabase/queries/depenses-hors-fenetre.sql
SELECT p.account_id,
       p.start_date,
       p.end_date,
       count(t.id) AS depenses_apres_la_fin,
       coalesce(sum(t.amount), 0) AS total_centimes,
       count(t.id) FILTER (WHERE coalesce(t.pending, false)) AS dont_pending
FROM public.periods p
LEFT JOIN public.transactions t
  ON t.account_id = p.account_id
 AND t.date > p.end_date
 AND t.amount < 0
WHERE p.is_active
  AND p.end_date IS NOT NULL
GROUP BY p.account_id, p.start_date, p.end_date
ORDER BY p.account_id, p.start_date DESC;
