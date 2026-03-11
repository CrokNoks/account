import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface ScanReceiptResponse {
  date: string | null;
  amount: number | null;
  description: string | null;
}

export function useScanReceipt() {
  return useMutation({
    mutationFn: async ({ accountId, base64Image, mimeType }: { accountId: string, base64Image: string, mimeType: string }) => {
      const { data } = await apiClient.post<ScanReceiptResponse>(`/${accountId}/reporting/scan-receipt`, {
        base64Image,
        mimeType,
      });
      return data;
    },
  });
}
