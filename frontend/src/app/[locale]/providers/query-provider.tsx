'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createMutationCache } from '@/shared/api/mutation-error';
import { AppTour } from '@/shared/ui/tour/AppTour';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Common');
  const tApi = useTranslations('ApiErrors');
  const errorMessage = t('error');
  const [{ cache: mutationCache, setFallback }] = useState(() => createMutationCache(errorMessage, tApi));
  useEffect(() => setFallback(errorMessage, tApi), [setFallback, errorMessage, tApi]);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache,
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <AppTour />
    </QueryClientProvider>
  );
}
