import { MutationCache, type Mutation } from '@tanstack/react-query';
import { toast } from 'sonner';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { skipGlobalErrorToast?: boolean };
  }
}

/**
 * Message to show for a failed API call. The back returns clean business messages in
 * `response.data.message`; for Nest validation errors (400) it is a `string[]`, joined here.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  if (Array.isArray(message)) {
    const parts = message.filter((m): m is string => typeof m === 'string' && m.trim() !== '');
    return parts.length > 0 ? parts.join(' · ') : fallback;
  }
  if (typeof message === 'string' && message.trim() !== '') return message;
  return fallback;
}

/**
 * A mutation shows the global toast unless it handles its error itself:
 * - it declares `onError` in its `useMutation` options, or
 * - it sets `meta: { skipGlobalErrorToast: true }` (needed when `onError` is passed
 *   per call, in `mutate(vars, { onError })`, which the cache cannot see).
 */
export function shouldShowGlobalErrorToast(
  mutation: Mutation<unknown, unknown, unknown, unknown>,
): boolean {
  return !mutation.options.onError && !mutation.meta?.skipGlobalErrorToast;
}

export function createMutationCache(initialFallback: string) {
  let fallback = initialFallback;
  const cache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!shouldShowGlobalErrorToast(mutation)) return;
      toast.error(getApiErrorMessage(error, fallback));
    },
  });
  return { cache, setFallback: (message: string) => { fallback = message; } };
}
