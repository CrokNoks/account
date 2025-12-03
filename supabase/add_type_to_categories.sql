-- Add type column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('expense', 'income'));

-- Add comment to explain the column
COMMENT ON COLUMN categories.type IS 'Type of category: expense or income. Used for budgeting.';
