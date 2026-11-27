-- Mesure d'impact « sens d'un budget de virement » : écart du prévu dû au sens des budgets de virement.
-- Par période, hors solde de départ (identique des deux côtés, donc l'écart est exact), limité aux catégories de
-- type virement (transfer) dont le budget est non nul :
--   ancien : virement compté en revenu, budget lu en valeur absolue : réel >= 0 -> max(réel, |budget|) ; réel < 0 -> réel.
--   nouveau : sens = signe du budget (à défaut du réel, non utilisé ici : budget non nul).
--     budget > 0 (entrant) : règle d'avant (revenu), donc écart nul ;
--     budget < 0 (sortant) : compté comme une dépense, -max(max(0, -réel), |budget|) + max(0, réel).
-- Réel d'une catégorie = somme de ses transactions dans la fenêtre de la période (pending comprises) :
--   date >= début ET (fermée : pas de fin OU date <= fin ; active : tout sauf la prochaine paie, soit une pending de la
--   catégorie déclencheuse avec recurringId datée après la fin), comme period-window.ts.
-- Contrôle : sur une période active où « Virement CJ » (−2 032,48 €) n'est pas parti, ecart_centimes = -406496.
-- ATTENTION : reproduit la formule en SQL (le prévu réel est calculé par le back).
-- Lecture seule (transaction read only, annulée). Montants en centimes.
-- Lancement local : docker exec -i supabase_db_account-v2 psql -U postgres < supabase/queries/prevu-virements-sens.sql
-- Lancement distant : PGOPTIONS='-c default_transaction_read_only=on' psql "<url>" -f supabase/queries/prevu-virements-sens.sql
begin read only;

WITH reel AS (
  SELECT p.id AS period_id, t.category_id, sum(t.amount) AS reel
  FROM public.periods p
  JOIN public.transactions t
    ON t.account_id = p.account_id
   AND t.date >= p.start_date
   AND CASE
         WHEN p.is_active THEN NOT (
           p.end_date IS NOT NULL
           AND t.pending IS TRUE
           AND t.date > p.end_date
           AND coalesce(t.metadata->>'recurringId', '') <> ''
           AND EXISTS (SELECT 1 FROM public.categories c
                       WHERE c.id = t.category_id AND c.is_period_trigger))
         ELSE (p.end_date IS NULL OR t.date <= p.end_date)
       END
  WHERE t.category_id IS NOT NULL
  GROUP BY p.id, t.category_id
),
virements AS (
  SELECT b.period_id,
         b.amount_allocated AS budget_signe,
         abs(b.amount_allocated) AS budget,
         coalesce(r.reel, 0) AS reel
  FROM public.budget_instances b
  JOIN public.categories c ON c.id = b.category_id AND c.type = 'transfer'
  LEFT JOIN reel r ON r.period_id = b.period_id AND r.category_id = b.category_id
  WHERE b.amount_allocated <> 0
),
par_virement AS (
  SELECT period_id,
         budget_signe,
         -- ancienne règle : revenu, budget en valeur absolue
         CASE WHEN reel >= 0 THEN greatest(reel, budget) ELSE reel END AS ancien,
         -- règle du sens
         CASE WHEN budget_signe < 0
              THEN -greatest(greatest(-reel, 0), budget) + greatest(reel, 0)
              ELSE CASE WHEN reel >= 0 THEN greatest(reel, budget) ELSE reel END
         END AS nouveau
  FROM virements
),
par_periode AS (
  SELECT period_id,
         sum(ancien) AS ancien,
         sum(nouveau) AS nouveau,
         count(*) FILTER (WHERE budget_signe < 0) AS virements_sortants
  FROM par_virement
  GROUP BY period_id
),
prevu AS (
  SELECT p.account_id, p.start_date, p.end_date, p.is_active,
         coalesce(pp.virements_sortants, 0) AS virements_sortants,
         coalesce(pp.ancien, 0) AS virements_ancien_centimes,
         coalesce(pp.nouveau, 0) AS virements_nouveau_centimes,
         coalesce(pp.nouveau, 0) - coalesce(pp.ancien, 0) AS ecart_centimes
  FROM public.periods p
  LEFT JOIN par_periode pp ON pp.period_id = p.id
)
-- Une ligne par période dont le prévu change ; periodes_total et part_pct portent sur toutes les périodes.
SELECT account_id, start_date, end_date, is_active,
       virements_sortants,
       virements_ancien_centimes,
       virements_nouveau_centimes,
       ecart_centimes,
       periodes_total,
       periodes_qui_changent,
       round(100.0 * periodes_qui_changent / nullif(periodes_total, 0), 1) AS part_pct
FROM (
  SELECT *,
         count(*) OVER () AS periodes_total,
         count(*) FILTER (WHERE ecart_centimes <> 0) OVER () AS periodes_qui_changent
  FROM prevu
) x
WHERE ecart_centimes <> 0
ORDER BY account_id, start_date DESC;

rollback;
