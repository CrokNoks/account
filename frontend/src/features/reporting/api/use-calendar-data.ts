import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { CalendarEvent } from '../model/types';

export function useCalendarData(accountId: string | null, year: number, month: number) {
  return useQuery<CalendarEvent[]>({
    queryKey: ['calendar', accountId, year, month],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await apiClient.get(`/${accountId}/reporting/calendar`, {
        params: { year, month },
      });
      return data;
    },
    enabled: !!accountId,
  });
}
