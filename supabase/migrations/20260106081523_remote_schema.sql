drop extension if exists "pg_net";

drop policy "Owners can manage shares" on "public"."account_shares";

drop policy "Owners can view shares for their accounts" on "public"."account_shares";

drop policy "Users can view accounts they own or are shared with" on "public"."accounts";

alter table "public"."categories" drop constraint "categories_user_id_fkey";

alter table "public"."expenses" drop constraint "expenses_user_id_fkey";

drop index if exists "public"."idx_categories_user_id";

drop index if exists "public"."idx_expenses_user_id";

alter table "public"."categories" drop column "user_id";

alter table "public"."expenses" drop column "user_id";

alter table "public"."expenses" alter column "description" set data type text using "description"::text;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auto_assign_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_owned_account_ids()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY SELECT id FROM public.accounts WHERE owner_id = auth.uid();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_account_access(p_account_id uuid, required_permission character varying DEFAULT 'read'::character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id AND owner_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.account_shares
    WHERE account_id = p_account_id
      AND user_id = auth.uid()
      AND (permission = required_permission
           OR (required_permission = 'read' AND permission = 'write'))
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$
;


  create policy "Owners can manage shares"
  on "public"."account_shares"
  as permissive
  for all
  to public
using ((account_id IN ( SELECT public.get_owned_account_ids() AS get_owned_account_ids)));



  create policy "Owners can view shares for their accounts"
  on "public"."account_shares"
  as permissive
  for select
  to public
using (((account_id IN ( SELECT public.get_owned_account_ids() AS get_owned_account_ids)) OR (user_id = auth.uid())));



  create policy "Users can view accounts they own or are shared with"
  on "public"."accounts"
  as permissive
  for select
  to public
using (((owner_id = auth.uid()) OR (id IN ( SELECT account_shares.account_id
   FROM public.account_shares
  WHERE (account_shares.user_id = auth.uid())))));



