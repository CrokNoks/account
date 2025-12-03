-- Add initial_balance column to accounts table
ALTER TABLE public.accounts
ADD COLUMN initial_balance DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN public.accounts.initial_balance IS 'Solde initial du compte pour le premier rapport';
