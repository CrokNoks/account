-- Add period_id column to expenses
ALTER TABLE public.expenses
ADD COLUMN period_id UUID REFERENCES public.periods(id) ON DELETE SET NULL;

CREATE INDEX idx_expenses_period_id ON public.expenses(period_id);

-- Function to automatically assign period_id based on account active period or date matching
-- Ideally, we assign the currently active period for the account.
CREATE OR REPLACE FUNCTION public.assign_period_id()
RETURNS TRIGGER AS $$
DECLARE
  v_period_id UUID;
BEGIN
  -- Only assign if not provided
  IF NEW.period_id IS NULL THEN
    SELECT id INTO v_period_id
    FROM public.periods
    WHERE account_id = NEW.account_id
      AND is_active = TRUE
    LIMIT 1;

    -- Fallback: If no active period matches, find strictly by date range?
    -- Requirement says "active period at that moment". If importing old data, this might be tricky.
    -- Assuming "active at that moment" means the period currently marked active in the system.
    
    IF v_period_id IS NOT NULL THEN
      NEW.period_id := v_period_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_expenses_period_id
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_period_id();
