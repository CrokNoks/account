-- Add payment_method column to expenses table
ALTER TABLE expenses
ADD COLUMN payment_method text;

-- Add check constraint for valid values (optional but good practice)
ALTER TABLE expenses
ADD CONSTRAINT expenses_payment_method_check 
CHECK (payment_method IN ('credit_card', 'direct_debit', 'transfer', 'check', 'cash', 'other'));

-- Comment on column
COMMENT ON COLUMN expenses.payment_method IS 'Moyen de paiement : credit_card, direct_debit, transfer, check, cash, other';
