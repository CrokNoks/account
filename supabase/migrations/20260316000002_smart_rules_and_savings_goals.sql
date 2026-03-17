-- Migration: Add Smart Rules and Savings Goals
-- Date: 2026-03-16

-- 1. Smart Rules
CREATE TABLE IF NOT EXISTS public.smart_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  pattern TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  tag_ids UUID[] DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Smart Rules
ALTER TABLE public.smart_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage smart rules via account access"
  ON public.smart_rules FOR ALL
  USING (public.has_account_access(account_id, 'write'));

-- 2. Savings Goals
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount BIGINT NOT NULL,
  current_amount BIGINT DEFAULT 0,
  deadline DATE,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Savings Goals
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage savings goals via account access"
  ON public.savings_goals FOR ALL
  USING (public.has_account_access(account_id, 'write'));

-- Triggers for updated_at
CREATE TRIGGER set_smart_rules_updated_at
  BEFORE UPDATE ON public.smart_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_savings_goals_updated_at
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
