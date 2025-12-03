-- ============================================================================
-- COMPLETE DATABASE SCHEMA FOR ACCOUNT V2
-- ============================================================================
-- This script creates all tables, policies, functions, and triggers needed
-- for the Account V2 application.
-- Run this script on a fresh Supabase database.
-- ============================================================================

-- ============================================================================
-- 1. BASE SCHEMA - Categories and Expenses Tables
-- ============================================================================

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3498db',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Categories policies (will be replaced later with account-based policies)
CREATE POLICY "Users can view their own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

-- Expenses policies (will be replaced later with account-based policies)
CREATE POLICY "Users can view their own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX idx_expenses_date ON public.expenses(date);
CREATE INDEX idx_categories_user_id ON public.categories(user_id);

-- ============================================================================
-- 2. ACCOUNTS SYSTEM - Multi-user account sharing
-- ============================================================================

-- Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create account_shares table
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

-- Modify existing tables to link to accounts
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON public.accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_account_shares_account_id ON public.account_shares(account_id);
CREATE INDEX IF NOT EXISTS idx_account_shares_user_id ON public.account_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_account_id ON public.categories(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);

-- Helper function to check access
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
      OR (required_permission = 'read' AND permission = 'write')
    )
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for ACCOUNTS
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

-- RLS Policies for ACCOUNT SHARES
CREATE POLICY "Owners can view shares for their accounts"
  ON public.account_shares FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE id = account_shares.account_id AND owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Owners can manage shares"
  ON public.account_shares FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE id = account_shares.account_id AND owner_id = auth.uid())
  );

-- Update CATEGORIES policies
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

-- Update EXPENSES policies
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

-- ============================================================================
-- 3. REPORTS SYSTEM
-- ============================================================================

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
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reports
CREATE POLICY "Access reports via account"
  ON public.reports FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Manage reports via account"
  ON public.reports FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete reports via account"
  ON public.reports FOR DELETE
  USING (public.has_account_access(account_id, 'write'));

-- ============================================================================
-- 4. ADDITIONAL COLUMNS - Reconciliation, Budget, Initial Balance
-- ============================================================================

-- Add reconciled column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT FALSE;

-- Add initial_balance column to accounts table
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS initial_balance DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN public.accounts.initial_balance IS 'Solde initial du compte pour le premier rapport';

-- Add budget column to categories table
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS budget DECIMAL(10, 2) DEFAULT NULL;

COMMENT ON COLUMN public.categories.budget IS 'Monthly budget limit for this category. NULL means no budget limit.';

-- Add type column to categories table
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('expense', 'income'));

COMMENT ON COLUMN public.categories.type IS 'Type of category: expense or income. Used for budgeting.';

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
