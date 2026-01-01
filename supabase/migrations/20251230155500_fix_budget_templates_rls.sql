-- Drop existing policy
DROP POLICY IF EXISTS "Manage budget templates via account" ON public.budget_templates;

-- Re-create policy with inlined logic to debug/fix potential function issues
-- We check ownership OR write permission in shares
CREATE POLICY "Manage budget templates via account"
  ON public.budget_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE id = account_id 
      AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.account_shares 
      WHERE account_id = budget_templates.account_id 
      AND user_id = auth.uid()
      AND permission = 'write'
    )
  );
