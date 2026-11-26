-- Fige le search_path de toutes les fonctions de public qui n'en avaient pas.
-- SECURITY DEFINER : sinon un objet homonyme placé dans un schéma plus tôt dans le chemin de
-- l'appelant serait résolu avec les droits du propriétaire. Les autres : même hygiène (linter Supabase).
-- Les corps ne changent pas : ils qualifient public.* / auth.uid() ou n'utilisent que des tables de public.
-- ALTER FUNCTION ne modifie que pg_proc (verrou bref) ; les droits EXECUTE sont conservés.

-- SECURITY DEFINER
ALTER FUNCTION public.auto_assign_user_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_owned_account_ids() SET search_path = public, pg_temp;
ALTER FUNCTION public.has_account_access(uuid, character varying) SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_app_users() SET search_path = public, pg_temp;

-- SECURITY INVOKER
ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.assign_period_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_balance_history(uuid, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_evolution_data(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_evolution_data(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_category_historical_stats(uuid) SET search_path = public, pg_temp;
