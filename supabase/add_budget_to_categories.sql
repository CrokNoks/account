-- Add budget column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS budget DECIMAL(10, 2) DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN categories.budget IS 'Monthly budget limit for this category. NULL means no budget limit.';
