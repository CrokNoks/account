-- ============================================================================
-- DATA MIGRATION: Expenses → Transactions
-- ============================================================================
-- This migration script moves data from the expenses table to the new
-- transactions table while:
-- 1. Inferring transaction type (expense vs income) from amount
-- 2. Assigning periods automatically via trigger
-- 3. Preserving all metadata
-- 4. Creating audit trail entries
-- ============================================================================

-- Step 1: Start transaction
BEGIN;

-- Step 2: Check counts before migration
DO $$
DECLARE
  v_expense_count INT;
  v_transaction_count INT;
BEGIN
  SELECT COUNT(*) INTO v_expense_count FROM public.expenses;
  RAISE NOTICE 'Expenses to migrate: %', v_expense_count;
END $$;

-- Step 3: Migrate expenses data
INSERT INTO public.transactions (
  id,
  account_id,
  type,
  amount,
  currency,
  date,
  description,
  notes,
  category_id,
  payment_method_id,
  reconciliation_status,
  metadata,
  created_by,
  created_at,
  updated_at
)
SELECT
  COALESCE(e.id, gen_random_uuid()),
  e.account_id,
  
  -- Type inference: expenses are negative amounts, so they're "expense" type
  CASE
    WHEN e.amount < 0 THEN 'expense'
    WHEN e.amount > 0 THEN 'income'
    ELSE 'adjustment'
  END as type,
  
  -- Store absolute value to match transaction amount semantics
  ABS(e.amount) as amount,
  
  COALESCE(e.currency, 'EUR') as currency,
  e.date,
  e.description,
  e.notes,
  e.category_id,
  
  -- Try to infer payment method from metadata or NULL
  (e.metadata->>'payment_method_id')::UUID as payment_method_id,
  
  -- Set initial reconciliation status based on reconciled flag
  CASE
    WHEN e.reconciled = TRUE THEN 'reconciled'
    ELSE 'pending'
  END as reconciliation_status,
  
  -- Preserve metadata and add migration marker
  jsonb_set(
    e.metadata || '{"migrated_from": "expenses"}'::JSONB,
    '{migration_date}',
    to_jsonb(NOW()::TEXT)
  ) as metadata,
  
  -- Preserve creation information
  e.user_id as created_by,
  e.created_at,
  e.updated_at
  
FROM public.expenses e
WHERE e.id NOT IN (SELECT id FROM public.transactions WHERE metadata->>'migrated_from' = 'expenses');

-- Step 4: Update reconciliation timestamps for reconciled transactions
UPDATE public.transactions
SET reconciled_at = updated_at
WHERE reconciliation_status = 'reconciled'
AND reconciled_at IS NULL
AND metadata->>'migrated_from' = 'expenses';

-- Step 5: Log migration to reconciliation history (for auditing)
INSERT INTO public.reconciliation_history (
  transaction_id,
  old_status,
  new_status,
  changed_by,
  reason
)
SELECT
  t.id,
  NULL,
  t.reconciliation_status,
  COALESCE(t.created_by, auth.uid()),
  'Migrated from expenses table'
FROM public.transactions t
WHERE t.metadata->>'migrated_from' = 'expenses'
AND t.id NOT IN (
  SELECT transaction_id FROM public.reconciliation_history 
  WHERE reason = 'Migrated from expenses table'
);

-- Step 6: Verify migration
DO $$
DECLARE
  v_migrated_count INT;
  v_transaction_count INT;
  v_expense_count INT;
BEGIN
  SELECT COUNT(*) INTO v_expense_count FROM public.expenses;
  SELECT COUNT(*) INTO v_transaction_count FROM public.transactions;
  SELECT COUNT(*) INTO v_migrated_count FROM public.transactions WHERE metadata->>'migrated_from' = 'expenses';
  
  RAISE NOTICE '=== MIGRATION SUMMARY ===';
  RAISE NOTICE 'Original expenses: %', v_expense_count;
  RAISE NOTICE 'New transactions: %', v_transaction_count;
  RAISE NOTICE 'Successfully migrated: %', v_migrated_count;
  
  IF v_migrated_count = v_expense_count THEN
    RAISE NOTICE '✅ Migration successful: All expenses migrated to transactions';
  ELSE
    RAISE WARNING '⚠️ Partial migration: Some expenses may not have been migrated';
  END IF;
END $$;

-- Step 7: Mark migration complete in metadata
CREATE TABLE IF NOT EXISTS public.migrations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  rows_affected INT,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.migrations_log (
  migration_name,
  status,
  rows_affected,
  completed_at
) VALUES (
  'expenses_to_transactions',
  'completed',
  (SELECT COUNT(*) FROM public.transactions WHERE metadata->>'migrated_from' = 'expenses'),
  NOW()
);

-- Commit the transaction
COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ============================================================================

-- Query 1: Verify transaction type distribution
SELECT 
  type,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(amount) as min_amount,
  MAX(amount) as max_amount
FROM public.transactions
WHERE metadata->>'migrated_from' = 'expenses'
GROUP BY type
ORDER BY count DESC;

-- Query 2: Verify reconciliation status distribution
SELECT
  reconciliation_status,
  COUNT(*) as count,
  COUNT(CASE WHEN reconciled_at IS NOT NULL THEN 1 END) as with_timestamp
FROM public.transactions
WHERE metadata->>'migrated_from' = 'expenses'
GROUP BY reconciliation_status;

-- Query 3: Verify data integrity (no NULL critical fields)
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN id IS NULL THEN 1 END) as null_id,
  COUNT(CASE WHEN account_id IS NULL THEN 1 END) as null_account_id,
  COUNT(CASE WHEN type IS NULL THEN 1 END) as null_type,
  COUNT(CASE WHEN amount IS NULL THEN 1 END) as null_amount,
  COUNT(CASE WHEN date IS NULL THEN 1 END) as null_date,
  COUNT(CASE WHEN description IS NULL THEN 1 END) as null_description
FROM public.transactions
WHERE metadata->>'migrated_from' = 'expenses';

-- Query 4: Sample migrated transactions
SELECT
  id,
  type,
  amount,
  date,
  description,
  reconciliation_status,
  created_at
FROM public.transactions
WHERE metadata->>'migrated_from' = 'expenses'
LIMIT 10;

-- ============================================================================
-- ROLLBACK PLAN (if needed)
-- ============================================================================
-- To rollback this migration, run:
--
-- DELETE FROM public.transactions 
-- WHERE metadata->>'migrated_from' = 'expenses';
--
-- DELETE FROM public.reconciliation_history
-- WHERE reason = 'Migrated from expenses table';
--
-- ============================================================================
