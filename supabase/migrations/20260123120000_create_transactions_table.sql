-- ============================================================================
-- CREATE TRANSACTIONS TABLE - Phase 1 Data Model Improvement
-- ============================================================================
-- This migration creates the core transactions table that replaces the 
-- generic "expenses" table. It includes:
-- - Proper transaction type semantics (expense, income, transfer, adjustment)
-- - Reconciliation workflow (pending → confirmed → reconciled → disputed)
-- - Transfer linking for multi-account operations
-- - Full audit trail (created_by, created_at, updated_at)
-- - RLS security aligned with accounts
-- ============================================================================

-- ============================================================================
-- 1. TRANSACTION TYPE ENUM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_types (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO public.transaction_types (id, name, description) VALUES
  ('expense', 'Expense', 'Money outflow'),
  ('income', 'Income', 'Money inflow'),
  ('transfer', 'Transfer', 'Money transfer between accounts'),
  ('adjustment', 'Adjustment', 'Balance correction or manual adjustment')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. RECONCILIATION STATUS ENUM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reconciliation_statuses (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO public.reconciliation_statuses (id, name, description) VALUES
  ('pending', 'Pending', 'Transaction awaiting reconciliation'),
  ('confirmed', 'Confirmed', 'User confirmed but not bank matched'),
  ('reconciled', 'Reconciled', 'Matched with bank statement'),
  ('disputed', 'Disputed', 'Discrepancy detected'),
  ('reversed', 'Reversed', 'Transaction cancelled or reversed')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. PAYMENT METHODS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL, -- credit_card, bank_account, cash, check, digital_wallet
  
  -- Human readable name
  name VARCHAR(100),
  
  -- Flexible metadata (last4, iban, issuer, etc)
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(account_id, type, name)
);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Access payment methods via account"
  ON public.payment_methods FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Manage payment methods via account"
  ON public.payment_methods FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Update payment methods via account"
  ON public.payment_methods FOR UPDATE
  USING (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete payment methods via account"
  ON public.payment_methods FOR DELETE
  USING (public.has_account_access(account_id, 'write'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_account_id ON public.payment_methods(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON public.payment_methods(account_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER set_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. MAIN TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  
  -- Transaction classification
  type VARCHAR(20) REFERENCES public.transaction_types(id) NOT NULL,
  
  -- Financial details
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_id UUID REFERENCES public.periods(id) ON DELETE SET NULL,
  
  -- Description and context
  description TEXT NOT NULL,
  notes TEXT,
  
  -- Category and payment method
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  
  -- Reconciliation workflow
  reconciliation_status VARCHAR(20) REFERENCES public.reconciliation_statuses(id) DEFAULT 'pending',
  reconciled_at TIMESTAMP WITH TIME ZONE,
  reconciled_by UUID REFERENCES auth.users(id),
  
  -- Transfer linking (for type='transfer')
  linked_transaction_id UUID REFERENCES public.transactions(id),
  
  -- Audit trail
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata for extensibility
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Prevent exact duplicates
  UNIQUE(account_id, type, date, description, amount)
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Access transactions via account"
  ON public.transactions FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Create transactions via account"
  ON public.transactions FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Update transactions via account"
  ON public.transactions FOR UPDATE
  USING (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete transactions via account"
  ON public.transactions FOR DELETE
  USING (public.has_account_access(account_id, 'write'));

-- Indexes for performance
CREATE INDEX idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_status ON public.transactions(reconciliation_status);
CREATE INDEX idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX idx_transactions_payment_method_id ON public.transactions(payment_method_id);
CREATE INDEX idx_transactions_period_id ON public.transactions(period_id);
CREATE INDEX idx_transactions_linked ON public.transactions(linked_transaction_id);
CREATE INDEX idx_transactions_reconciled_at ON public.transactions(reconciled_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_transactions_account_date_status 
  ON public.transactions(account_id, date DESC, reconciliation_status);
CREATE INDEX idx_transactions_account_period_date 
  ON public.transactions(account_id, period_id, date);

-- Trigger for updated_at
CREATE TRIGGER set_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to auto-assign period based on date
CREATE OR REPLACE FUNCTION public.auto_assign_transaction_period()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.period_id IS NULL THEN
    SELECT id INTO NEW.period_id FROM public.periods
    WHERE account_id = NEW.account_id
    AND start_date <= NEW.date
    AND (end_date IS NULL OR end_date >= NEW.date)
    AND is_active = TRUE
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_assign_period_on_insert
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_transaction_period();

CREATE TRIGGER auto_assign_period_on_date_update
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  WHEN (OLD.date IS DISTINCT FROM NEW.date OR OLD.period_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_transaction_period();

-- ============================================================================
-- 5. RECONCILIATION HISTORY TABLE (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reconciliation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  
  -- State transition
  old_status VARCHAR(20) REFERENCES public.reconciliation_statuses(id),
  new_status VARCHAR(20) REFERENCES public.reconciliation_statuses(id) NOT NULL,
  
  -- Who and when
  changed_by UUID REFERENCES auth.users(id) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Context
  reason TEXT,
  
  UNIQUE(transaction_id, changed_at)
);

-- Enable RLS for history table (via transaction account)
ALTER TABLE public.reconciliation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see history for their transactions
CREATE POLICY "Access reconciliation history via transaction"
  ON public.reconciliation_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
      AND public.has_account_access(t.account_id, 'read')
    )
  );

-- Indexes
CREATE INDEX idx_reconciliation_history_transaction ON public.reconciliation_history(transaction_id);
CREATE INDEX idx_reconciliation_history_changed_by ON public.reconciliation_history(changed_by);
CREATE INDEX idx_reconciliation_history_changed_at ON public.reconciliation_history(changed_at DESC);

-- Trigger to auto-log reconciliation changes
CREATE OR REPLACE FUNCTION public.log_reconciliation_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reconciliation_status IS DISTINCT FROM OLD.reconciliation_status THEN
    INSERT INTO public.reconciliation_history (
      transaction_id,
      old_status,
      new_status,
      changed_by,
      reason
    ) VALUES (
      NEW.id,
      OLD.reconciliation_status,
      NEW.reconciliation_status,
      auth.uid(),
      NEW.metadata->>'reconciliation_reason'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_reconciliation_changes
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_reconciliation_change();

-- ============================================================================
-- 6. BACKWARD COMPATIBILITY VIEW
-- ============================================================================
-- This view maps transactions to the old "expenses" schema for compatibility

CREATE OR REPLACE VIEW public.expenses_compat AS
SELECT
  id,
  account_id,
  date,
  description,
  amount,
  category_id,
  notes,
  NULL::UUID as user_id,
  metadata->>'payment_method' as payment_method,
  (reconciliation_status = 'reconciled') as reconciled,
  created_at,
  updated_at
FROM public.transactions
WHERE type IN ('expense', 'income');

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Get balance at a specific date
CREATE OR REPLACE FUNCTION public.get_account_balance(
  p_account_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_balance NUMERIC,
  reconciled_balance NUMERIC,
  unreconciled_balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(
      CASE WHEN type = 'expense' THEN -amount
           WHEN type = 'income' THEN amount
           ELSE amount END
    ), 0)::NUMERIC as total_balance,
    COALESCE(SUM(
      CASE WHEN reconciliation_status = 'reconciled' THEN
        CASE WHEN type = 'expense' THEN -amount
             WHEN type = 'income' THEN amount
             ELSE amount END
      ELSE 0 END
    ), 0)::NUMERIC as reconciled_balance,
    COALESCE(SUM(
      CASE WHEN reconciliation_status != 'reconciled' THEN
        CASE WHEN type = 'expense' THEN -amount
             WHEN type = 'income' THEN amount
             ELSE amount END
      ELSE 0 END
    ), 0)::NUMERIC as unreconciled_balance
  FROM public.transactions
  WHERE account_id = p_account_id AND date <= p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unreconciled transaction count
CREATE OR REPLACE FUNCTION public.get_unreconciled_count(p_account_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COUNT(*)::INTEGER FROM public.transactions
  WHERE account_id = p_account_id
  AND reconciliation_status != 'reconciled'
  AND date <= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Update apps to use transactions table
-- 2. Migrate data from expenses table
-- 3. Update RLS on expenses table
-- 4. Deprecate expenses table in future version
