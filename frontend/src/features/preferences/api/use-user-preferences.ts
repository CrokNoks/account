import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface DashboardWidgetConfig {
  id: string;
  width: number;
  desktopVisible: boolean;
  mobileVisible: boolean;
}

export interface DashboardLayout {
  widgets: DashboardWidgetConfig[];
}

export interface UserPreferences {
  userId: string;
  dashboardLayout: DashboardLayout;
  updatedAt: string;
}

export function useUserPreferences() {
  return useQuery<UserPreferences>({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const { data } = await apiClient.get('/preferences');
      return data;
    },
  });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (layout: DashboardLayout) => {
      const { data } = await apiClient.patch('/preferences', layout);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-preferences'], data);
    },
  });
}
