-- Add reconciled column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT FALSE;

-- Update RLS policies if needed (usually not needed for simple column addition if policies cover UPDATE)
-- The existing policies already cover UPDATE based on account access, so no change needed there.
