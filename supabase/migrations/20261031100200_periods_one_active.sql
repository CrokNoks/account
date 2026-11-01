-- Une seule période active par compte (le trigger set_transactions_period_id
-- rattache les nouvelles transactions à LA période active). Garanti par la base,
-- donc aussi quand PATCH isActive:true réactive une période ou sous concurrence.
-- create_period_with_budgets désactive les autres AVANT d'insérer : compatible.
CREATE UNIQUE INDEX periods_one_active_per_account
  ON public.periods (account_id)
  WHERE is_active;
