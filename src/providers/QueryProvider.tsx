import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Create a client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Time in milliseconds that data remains fresh
      staleTime: 1000 * 60 * 2, // 2 minutes
      
      // Time in milliseconds that inactive queries will remain in cache
      gcTime: 1000 * 60 * 10, // 10 minutes
      
      // Number of times to retry failed requests
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = error.status as number;
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus (can be disabled for mobile)
      refetchOnWindowFocus: false,
      
      // Refetch on reconnect
      refetchOnReconnect: true,
      
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Number of times to retry failed mutations
      retry: 1,
      
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

export const QueryProvider = ({ children }: QueryProviderProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Export the client for use in components that need it directly
export { queryClient };