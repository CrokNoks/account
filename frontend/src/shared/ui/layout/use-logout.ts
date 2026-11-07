'use client';

import { useRouter } from '@/i18n/routing';
import { createClient } from '@/shared/lib/supabase/supabase-browser';

/** Déconnexion partagée (sidebar, « Plus » du mobile) : coupe la session puis va sur /login. */
export function useLogout() {
  const router = useRouter();
  const supabase = createClient();

  return async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };
}
