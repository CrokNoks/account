-- 1. Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create account_shares table
CREATE TABLE IF NOT EXISTS public.account_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission VARCHAR(20) CHECK (permission IN ('read', 'write')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, user_id)
);

-- Enable RLS on new tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_shares ENABLE ROW LEVEL SECURITY;

-- 3. Modify existing tables to link to accounts
-- We add account_id column. It's nullable for now to allow migration of existing data if needed, 
-- but ideally should be NOT NULL. We'll make it NOT NULL later or handle it in app logic.
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON public.accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_account_shares_account_id ON public.account_shares(account_id);
CREATE INDEX IF NOT EXISTS idx_account_shares_user_id ON public.account_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_account_id ON public.categories(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);

-- 4. Helper function to check access
-- Returns true if the current user is the owner OR has the required permission in shares
CREATE OR REPLACE FUNCTION public.has_account_access(account_id UUID, required_permission VARCHAR DEFAULT 'read')
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if owner
  IF EXISTS (
    SELECT 1 FROM public.accounts 
    WHERE id = account_id AND owner_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check if shared
  IF EXISTS (
    SELECT 1 FROM public.account_shares 
    WHERE account_id = account_id 
    AND user_id = auth.uid()
    AND (
      permission = required_permission 
      OR (required_permission = 'read' AND permission = 'write') -- write implies read
    )
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS Policies

-- ACCOUNTS
CREATE POLICY "Users can view accounts they own or are shared with"
  ON public.accounts FOR SELECT
  USING (
    owner_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.account_shares WHERE account_id = accounts.id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create accounts"
  ON public.accounts FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their accounts"
  ON public.accounts FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their accounts"
  ON public.accounts FOR DELETE
  USING (owner_id = auth.uid());

-- ACCOUNT SHARES
CREATE POLICY "Owners can view shares for their accounts"
  ON public.account_shares FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE id = account_shares.account_id AND owner_id = auth.uid())
    OR user_id = auth.uid() -- Users can see shares directed to them
  );

CREATE POLICY "Owners can manage shares"
  ON public.account_shares FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE id = account_shares.account_id AND owner_id = auth.uid())
  );

-- CATEGORIES (Update existing policies)
-- Drop old policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can create their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;

CREATE POLICY "Access categories via account"
  ON public.categories FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Manage categories via account"
  ON public.categories FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Update categories via account"
  ON public.categories FOR UPDATE
  USING (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete categories via account"
  ON public.categories FOR DELETE
  USING (public.has_account_access(account_id, 'write'));

-- EXPENSES (Update existing policies)
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can create their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;

CREATE POLICY "Access expenses via account"
  ON public.expenses FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Manage expenses via account"
  ON public.expenses FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Update expenses via account"
  ON public.expenses FOR UPDATE
  USING (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete expenses via account"
  ON public.expenses FOR DELETE
  USING (public.has_account_access(account_id, 'write'));

-- 6. Clean up old triggers
-- We drop the auto_assign_user_id triggers because now we rely on account_id
DROP TRIGGER IF EXISTS on_auth_user_created_categories ON public.categories;
DROP TRIGGER IF EXISTS on_auth_user_created_expenses ON public.expenses;
-- We can keep the function if we want, or drop it. Let's keep it harmless.
