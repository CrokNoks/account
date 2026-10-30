import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/shared/lib/supabase/supabase-browser';

/** Identifiant de l'utilisateur connecté (session Supabase), `undefined` tant qu'il n'est pas connu. */
export function useCurrentUserId(): string | undefined {
  const { data } = useQuery<string | null>({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data } = await createClient().auth.getSession();
      return data.session?.user.id ?? null;
    },
    staleTime: Infinity,
  });
  return data ?? undefined;
}
