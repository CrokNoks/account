-- Migration: Sync savings goals current_amount automatically based on linked transactions
-- Formula: current_amount = current_amount - transaction.amount
-- (Since putting money aside is a negative amount/expense, subtracting it increases the goal balance)

CREATE OR REPLACE FUNCTION public.sync_savings_goal_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Handle DELETE or OLD values in UPDATE
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.savings_goal_id IS NOT NULL THEN
        UPDATE public.savings_goals
        SET current_amount = current_amount + OLD.amount,
            updated_at = NOW()
        WHERE id = OLD.savings_goal_id;
    END IF;

    -- 2. Handle INSERT or NEW values in UPDATE
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.savings_goal_id IS NOT NULL THEN
        UPDATE public.savings_goals
        SET current_amount = current_amount - NEW.amount,
            updated_at = NOW()
        WHERE id = NEW.savings_goal_id;
    END IF;

    RETURN NULL; -- AFTER trigger
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_savings_goal_on_transaction ON public.transactions;
CREATE TRIGGER trg_sync_savings_goal_on_transaction
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_savings_goal_amount();
