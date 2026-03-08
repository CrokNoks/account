-- ============================================================================
-- ACCOUNT V2 - DATA TRANSFORMATION MIGRATION
-- ============================================================================
-- Description:
-- 1. Multiplies all monetary values by 100 and converts them to BIGINT (cents).
-- 2. Renames the 'expenses' table to 'transactions' to better reflect its role.
-- 3. Cleans up obsolete columns and updates constraints.
-- ============================================================================

BEGIN;

-- 1. ACCOUNTS TRANSFORMATION
-- Multiply initial_balance by 100 to convert to cents
UPDATE public.accounts SET initial_balance = ROUND(initial_balance * 100)::BIGINT;
ALTER TABLE public.accounts ALTER COLUMN initial_balance TYPE BIGINT;

-- Remove obsolete reporting columns
ALTER TABLE public.accounts 
  DROP COLUMN IF EXISTS report_start_category_id,
  DROP COLUMN IF EXISTS report_end_category_id;

-- 2. CATEGORIES TRANSFORMATION
-- Update type check constraint for new V2 values
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN (SELECT constraint_name FROM information_schema.constraint_column_usage WHERE table_name = 'categories' AND column_name = 'type') LOOP
        EXECUTE 'ALTER TABLE categories DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;
ALTER TABLE public.categories ADD CONSTRAINT categories_type_check CHECK (type IN ('expense', 'income', 'transfer', 'savings'));

-- Convert category budget to cents
UPDATE public.categories SET budget = ROUND(budget * 100)::BIGINT WHERE budget IS NOT NULL;
ALTER TABLE public.categories ALTER COLUMN budget TYPE BIGINT;

-- 3. EXPENSES TO TRANSACTIONS MIGRATION
-- Rename table
ALTER TABLE public.expenses RENAME TO transactions;

-- Convert amount to cents
UPDATE public.transactions SET amount = ROUND(amount * 100)::BIGINT;
ALTER TABLE public.transactions ALTER COLUMN amount TYPE BIGINT;

-- Rename indexes for consistency
ALTER INDEX IF EXISTS idx_expenses_account_id RENAME TO idx_transactions_account_id;
ALTER INDEX IF EXISTS idx_expenses_category_id RENAME TO idx_transactions_category_id;
ALTER INDEX IF EXISTS idx_expenses_date RENAME TO idx_transactions_date;
ALTER INDEX IF EXISTS idx_expenses_period_id RENAME TO idx_transactions_period_id;

-- Rename triggers
ALTER TRIGGER set_expenses_updated_at ON public.transactions RENAME TO set_transactions_updated_at;
ALTER TRIGGER set_expenses_period_id ON public.transactions RENAME TO set_transactions_period_id;

-- 4. BUDGETS TRANSFORMATION
-- Convert budget_templates.amount_base to cents
UPDATE public.budget_templates SET amount_base = ROUND(amount_base * 100)::BIGINT;
ALTER TABLE public.budget_templates ALTER COLUMN amount_base TYPE BIGINT;

-- Convert budget_instances.amount_allocated to cents
UPDATE public.budget_instances SET amount_allocated = ROUND(amount_allocated * 100)::BIGINT;
ALTER TABLE public.budget_instances ALTER COLUMN amount_allocated TYPE BIGINT;

-- 5. RLS POLICIES REFRESH
-- Renaming a table updates policies but it's cleaner to explicitly drop and re-create them.
DROP POLICY IF EXISTS "Access expenses via account" ON public.transactions;
DROP POLICY IF EXISTS "Manage expenses via account" ON public.transactions;
DROP POLICY IF EXISTS "Update expenses via account" ON public.transactions;
DROP POLICY IF EXISTS "Delete expenses via account" ON public.transactions;

CREATE POLICY "Access transactions via account"
  ON public.transactions FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Manage transactions via account"
  ON public.transactions FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Update transactions via account"
  ON public.transactions FOR UPDATE
  USING (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete transactions via account"
  ON public.transactions FOR DELETE
  USING (public.has_account_access(account_id, 'write'));

COMMIT;
