-- Fix infinite recursion in RLS policies

-- 1. Create a helper function to get owned account IDs securely
-- This function runs with SECURITY DEFINER to bypass RLS, preventing the recursion loop
CREATE OR REPLACE FUNCTION public.get_owned_account_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY SELECT id FROM public.accounts WHERE owner_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update ACCOUNT SHARES policies to use the helper function
-- Instead of querying accounts directly (which triggers RLS), we use the secure function
DROP POLICY IF EXISTS "Owners can view shares for their accounts" ON public.account_shares;
CREATE POLICY "Owners can view shares for their accounts"
  ON public.account_shares FOR SELECT
  USING (
    account_id IN (SELECT public.get_owned_account_ids())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Owners can manage shares" ON public.account_shares;
CREATE POLICY "Owners can manage shares"
  ON public.account_shares FOR ALL
  USING (
    account_id IN (SELECT public.get_owned_account_ids())
  );

-- 3. Update ACCOUNTS policy to be simpler
-- This one was probably fine, but let's make it robust.
-- The recursion usually happens when table A queries table B, and table B queries table A.
-- By making table B (shares) use a SECURITY DEFINER function to query table A (accounts), we break the loop.
DROP POLICY IF EXISTS "Users can view accounts they own or are shared with" ON public.accounts;
CREATE POLICY "Users can view accounts they own or are shared with"
  ON public.accounts FOR SELECT
  USING (
    owner_id = auth.uid() OR 
    id IN (SELECT account_id FROM public.account_shares WHERE user_id = auth.uid())
  );
