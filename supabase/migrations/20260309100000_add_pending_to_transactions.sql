-- Add pending column to transactions table
ALTER TABLE public.transactions ADD COLUMN pending BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.transactions.pending IS 'Indicates if the transaction is pre-authorized/pending and should not be counted in the cleared balance yet.';
