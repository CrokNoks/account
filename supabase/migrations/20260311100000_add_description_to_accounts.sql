-- Add description column to accounts table
ALTER TABLE public.accounts ADD COLUMN description TEXT;

COMMENT ON COLUMN public.accounts.description IS 'A short pitch or description of the account purpose to provide context for AI analysis.';
