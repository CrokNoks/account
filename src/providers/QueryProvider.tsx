import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Type-safe error handling for HTTP errors
interface HttpError {
  status?: number;
  message?: string;
}

// Create a client with optimized defaults following AGENTS.md guidelines
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Time in milliseconds that data remains fresh
      staleTime: 5 * 60 * 1000, // 5 minutes - improved caching
      
      // Time in milliseconds that inactive queries will remain in cache
      gcTime: 10 * 60 * 1000, // 10 minutes
      
      // Type-safe retry logic for failed requests
      retry: (failureCount, error: unknown): boolean => {
        // Don't retry on 4xx errors (client errors)
        const httpError = error as HttpError;
        if (httpError.status && httpError.status >= 400 && httpError.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus (disabled for mobile performance)
      refetchOnWindowFocus: false,
      
      // Refetch on reconnect
      refetchOnReconnect: true,
      
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Type-safe retry logic for mutations
      retry: (failureCount, error: unknown): boolean => {
        const httpError = error as HttpError;
        if (httpError.status && httpError.status >= 400 && httpError.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

// Memoized QueryProvider component following performance guidelines
export const QueryProvider = ({ children }: QueryProviderProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Export client for debugging in development
if (import.meta.env.DEV) {
  (window as any).queryClient = queryClient;
}

// Export client for use in components that need it directly
export { queryClient };