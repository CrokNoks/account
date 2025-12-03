-- Add report configuration columns to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS report_start_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS report_end_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create reports table for archiving
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  data JSONB NOT NULL, -- Stores the snapshot of the report (totals, breakdown, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reports
-- Users can view reports for accounts they have access to
CREATE POLICY "Access reports via account"
  ON public.reports FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

-- Users with write access to the account can create reports (archive)
CREATE POLICY "Manage reports via account"
  ON public.reports FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

-- Owners can delete reports
CREATE POLICY "Delete reports via account"
  ON public.reports FOR DELETE
  USING (public.has_account_access(account_id, 'write'));
