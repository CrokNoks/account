CREATE TABLE IF NOT EXISTS public.budget_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES public.periods(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  amount_allocated DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(period_id, category_id)
);

-- Note: This table links a specific period to a category with a calculated budget amount.

-- Enable RLS
ALTER TABLE public.budget_instances ENABLE ROW LEVEL SECURITY;

-- We need policies that traverse period -> account to check access.
-- Since RLS can be performance heavy with joins, define helper or rely on function logic.
-- However, we can also add account_id directly for easier RLS, OR use EXISTS subquery.

-- Let's stick to strict relation: Check if user has access to the account of the period.
CREATE POLICY "Access budget instances via period"
  ON public.budget_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.periods
      WHERE id = budget_instances.period_id
      AND public.has_account_access(periods.account_id, 'read')
    )
  );

CREATE POLICY "Manage budget instances via period"
  ON public.budget_instances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.periods
      WHERE id = budget_instances.period_id
      AND public.has_account_access(periods.account_id, 'write')
    )
  );

CREATE POLICY "Update budget instances via period"
  ON public.budget_instances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.periods
      WHERE id = budget_instances.period_id
      AND public.has_account_access(periods.account_id, 'write')
    )
  );

CREATE POLICY "Delete budget instances via period"
  ON public.budget_instances FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.periods
      WHERE id = budget_instances.period_id
      AND public.has_account_access(periods.account_id, 'write')
    )
  );

-- Trigger
CREATE TRIGGER set_budget_instances_updated_at
  BEFORE UPDATE ON public.budget_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_budget_instances_period_id ON public.budget_instances(period_id);
CREATE INDEX idx_budget_instances_category_id ON public.budget_instances(category_id);
