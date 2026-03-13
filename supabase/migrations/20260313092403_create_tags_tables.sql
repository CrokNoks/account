-- Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, name)
);

-- Create transaction_tags junction table
CREATE TABLE IF NOT EXISTS public.transaction_tags (
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (transaction_id, tag_id)
);

-- Enable Row Level Security
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;

-- Tags Policies
CREATE POLICY "Access tags via account"
  ON public.tags FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Manage tags via account"
  ON public.tags FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Update tags via account"
  ON public.tags FOR UPDATE
  USING (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete tags via account"
  ON public.tags FOR DELETE
  USING (public.has_account_access(account_id, 'write'));

-- Transaction Tags Policies
-- We access transaction_tags if we have access to the related transaction's account
CREATE POLICY "Access transaction_tags via transaction account"
  ON public.transaction_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_tags.transaction_id
      AND public.has_account_access(t.account_id, 'read')
    )
  );

CREATE POLICY "Manage transaction_tags via transaction account"
  ON public.transaction_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_tags.transaction_id
      AND public.has_account_access(t.account_id, 'write')
    )
  );

CREATE POLICY "Update transaction_tags via transaction account"
  ON public.transaction_tags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_tags.transaction_id
      AND public.has_account_access(t.account_id, 'write')
    )
  );

CREATE POLICY "Delete transaction_tags via transaction account"
  ON public.transaction_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_tags.transaction_id
      AND public.has_account_access(t.account_id, 'write')
    )
  );

-- Add updated_at trigger for tags
CREATE TRIGGER set_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_account_id ON public.tags(account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_transaction_id ON public.transaction_tags(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag_id ON public.transaction_tags(tag_id);
