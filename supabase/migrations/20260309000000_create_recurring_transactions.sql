-- Create recurring_transactions table
CREATE TABLE public.recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    amount BIGINT NOT NULL,
    day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Access recurring transactions via account"
  ON public.recurring_transactions FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Manage recurring transactions via account"
  ON public.recurring_transactions FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Update recurring transactions via account"
  ON public.recurring_transactions FOR UPDATE
  USING (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete recurring transactions via account"
  ON public.recurring_transactions FOR DELETE
  USING (public.has_account_access(account_id, 'write'));

-- Add updated_at trigger
CREATE TRIGGER set_recurring_transactions_updated_at
    BEFORE UPDATE ON public.recurring_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Add index for performance
CREATE INDEX idx_recurring_transactions_account_id ON public.recurring_transactions(account_id);
