-- Mesure d'impact « soldes et prévu justes » : prévu ancien (max sur le total) contre prévu nouveau (max par catégorie).
-- Par période : ecart_centimes = nouveau - ancien, hors solde de départ (identique des deux côtés, donc l'écart est exact).
--   prevu_hors_depart = revenus retenus - dépenses retenues + remboursements + sans catégorie.
-- Réel d'une catégorie = somme de ses transactions dans la fenêtre de la période (pending comprises) :
--   date >= début ET (pas de fin OU date <= fin OU (période active ET montant < 0)), comme period-window.ts.
-- Budget = |amount_allocated| ; une catégorie sans ligne de budget vaut 0.
-- Ancien : max(Σ réel revenus, Σ |budget| revenus) ; max(max(0, -Σ réel dépenses), Σ |budget| dépenses) ; remboursement = max(0, Σ réel dépenses).
-- Nouveau : par catégorie. Dépenses/épargne : retenu = max(max(0,-réel), |budget|), remboursement = max(0,réel).
--           Revenus (income) : réel >= 0 -> max(réel, |budget|) ; réel < 0 -> |budget| + réel.
--           Virements (transfer) : réel >= 0 -> max(réel, |budget|) ; réel < 0 -> réel (sortant déjà passé, budget ignoré).
-- ATTENTION : reproduit la formule en SQL (le prévu réel est calculé par le back). À contrôler sur une période connue
-- (exemple A) : la somme prevu_hors_depart + départ doit égaler le « prévu » des stats de la période.
-- Lecture seule. Montants en centimes. Un seul SELECT (compatible avec une session en lecture seule, aucun objet temporaire).
-- Lancement local : docker exec -i supabase_db_account-v2 psql -U postgres < supabase/queries/prevu-par-categorie.sql
-- Lancement distant : PGOPTIONS='-c default_transaction_read_only=on' psql "<url>" -f supabase/queries/prevu-par-categorie.sql
WITH reel AS (
  SELECT p.id AS period_id, t.category_id, sum(t.amount) AS reel
  FROM public.periods p
  JOIN public.transactions t
    ON t.account_id = p.account_id
   AND t.date >= p.start_date
   AND (p.end_date IS NULL
        OR t.date <= p.end_date
        OR (p.is_active AND t.amount < 0))
  WHERE t.category_id IS NOT NULL
  GROUP BY p.id, t.category_id
),
sans_categorie AS (
  SELECT p.id AS period_id, coalesce(sum(t.amount), 0) AS total
  FROM public.periods p
  LEFT JOIN public.transactions t
    ON t.account_id = p.account_id
   AND t.category_id IS NULL
   AND t.date >= p.start_date
   AND (p.end_date IS NULL
        OR t.date <= p.end_date
        OR (p.is_active AND t.amount < 0))
  GROUP BY p.id
),
lignes AS (
  SELECT coalesce(r.period_id, b.period_id) AS period_id,
         coalesce(r.category_id, b.category_id) AS category_id,
         coalesce(r.reel, 0) AS reel,
         abs(coalesce(b.amount_allocated, 0)) AS budget
  FROM reel r
  FULL JOIN public.budget_instances b
    ON b.period_id = r.period_id AND b.category_id = r.category_id
),
par_categorie AS (
  SELECT l.period_id,
         c.type IN ('income', 'transfer') AS est_revenu,
         l.reel,
         l.budget,
         -- règle nouvelle, par catégorie
         CASE WHEN c.type IN ('income', 'transfer')
              THEN CASE WHEN l.reel >= 0 THEN greatest(l.reel, l.budget)
                        WHEN c.type = 'transfer' THEN l.reel
                        ELSE l.budget + l.reel END
              ELSE greatest(greatest(-l.reel, 0), l.budget) END AS retenu,
         CASE WHEN c.type IN ('income', 'transfer') THEN 0 ELSE greatest(l.reel, 0) END AS remboursement
  FROM lignes l
  JOIN public.categories c ON c.id = l.category_id
),
sommes AS (
  SELECT period_id,
         sum(reel) FILTER (WHERE est_revenu) AS reel_revenus,
         sum(budget) FILTER (WHERE est_revenu) AS budget_revenus,
         sum(reel) FILTER (WHERE NOT est_revenu) AS reel_depenses,
         sum(budget) FILTER (WHERE NOT est_revenu) AS budget_depenses,
         sum(retenu) FILTER (WHERE est_revenu) AS retenu_revenus,
         sum(retenu) FILTER (WHERE NOT est_revenu) AS retenu_depenses,
         sum(remboursement) AS remboursements
  FROM par_categorie
  GROUP BY period_id
),
prevu AS (
SELECT p.account_id,
       p.start_date,
       p.end_date,
       p.is_active,
       -- ancien
       greatest(coalesce(s.reel_revenus, 0), coalesce(s.budget_revenus, 0))
         - greatest(greatest(-coalesce(s.reel_depenses, 0), 0), coalesce(s.budget_depenses, 0))
         + greatest(coalesce(s.reel_depenses, 0), 0)
         + sc.total AS prevu_ancien_hors_depart,
       -- nouveau
       coalesce(s.retenu_revenus, 0) - coalesce(s.retenu_depenses, 0) + coalesce(s.remboursements, 0)
         + sc.total AS prevu_nouveau_hors_depart
FROM public.periods p
JOIN sans_categorie sc ON sc.period_id = p.id
LEFT JOIN sommes s ON s.period_id = p.id
)
-- Une ligne par période dont le prévu change ; part_pct et periodes_total portent sur toutes les périodes.
SELECT account_id, start_date, end_date, is_active,
       prevu_ancien_hors_depart,
       prevu_nouveau_hors_depart,
       ecart_centimes,
       periodes_total,
       periodes_qui_changent,
       round(100.0 * periodes_qui_changent / nullif(periodes_total, 0), 1) AS part_pct
FROM (
  SELECT *,
         prevu_nouveau_hors_depart - prevu_ancien_hors_depart AS ecart_centimes,
         count(*) OVER () AS periodes_total,
         count(*) FILTER (WHERE prevu_nouveau_hors_depart <> prevu_ancien_hors_depart) OVER () AS periodes_qui_changent
  FROM prevu
) x
WHERE ecart_centimes <> 0
ORDER BY account_id, start_date DESC;
