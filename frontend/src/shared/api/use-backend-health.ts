import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const healthClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api',
});

export const useBackendHealth = () => {
  return useQuery({
    queryKey: ['backend-health'],
    queryFn: async () => {
      const { data } = await healthClient.get('/health');
      return data;
    },
    // Retry up to 10 times (more generous for cold starts)
    retry: 10,
    // Exponential backoff
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    staleTime: Infinity,
  });
};
