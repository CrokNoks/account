CREATE TABLE IF NOT EXISTS public.budget_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  amount_base DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_fixed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, category_id)
);

-- Note: is_fixed true = fixed expense (Rent), false = variable (Groceries)

-- Enable RLS
ALTER TABLE public.budget_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Access budget templates via account"
  ON public.budget_templates FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Manage budget templates via account"
  ON public.budget_templates FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Update budget templates via account"
  ON public.budget_templates FOR UPDATE
  USING (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete budget templates via account"
  ON public.budget_templates FOR DELETE
  USING (public.has_account_access(account_id, 'write'));

-- Trigger
CREATE TRIGGER set_budget_templates_updated_at
  BEFORE UPDATE ON public.budget_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_budget_templates_account_id ON public.budget_templates(account_id);
