-- Smart rules: a read-only share can read the rules; writing still requires 'write'.
-- The former FOR ALL policy required 'write' for SELECT too, hiding every rule from read-only shares.

DROP POLICY IF EXISTS "Manage smart rules via account access" ON public.smart_rules;

CREATE POLICY "Access smart rules via account"
  ON public.smart_rules FOR SELECT
  USING (public.has_account_access(account_id, 'read'));

CREATE POLICY "Manage smart rules via account"
  ON public.smart_rules FOR INSERT
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Update smart rules via account"
  ON public.smart_rules FOR UPDATE
  USING (public.has_account_access(account_id, 'write'))
  WITH CHECK (public.has_account_access(account_id, 'write'));

CREATE POLICY "Delete smart rules via account"
  ON public.smart_rules FOR DELETE
  USING (public.has_account_access(account_id, 'write'));
