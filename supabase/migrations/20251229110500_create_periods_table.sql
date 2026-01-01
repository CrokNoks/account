CREATE TABLE IF NOT EXISTS public.periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  estimated_end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Access periods via account"
  ON public.periods FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Manage periods via account"
  ON public.periods FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Update periods via account"
  ON public.periods FOR UPDATE
  USING (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete periods via account"
  ON public.periods FOR DELETE
  USING (public.has_account_access(account_id, 'write'));

-- Trigger for updated_at
CREATE TRIGGER set_periods_updated_at
  BEFORE UPDATE ON public.periods
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Index for performance
CREATE INDEX idx_periods_account_id ON public.periods(account_id);
