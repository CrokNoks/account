-- Add metadata column to expenses table for storing extra CSV details
ALTER TABLE expenses
ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN expenses.metadata IS 'Metadata for storing extra details like raw CSV lines, references, etc.';
