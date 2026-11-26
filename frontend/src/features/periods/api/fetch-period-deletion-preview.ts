import { apiClient } from '@/shared/api/api-client';
import { PeriodDeletionPreview } from '../model/types';

/** Lecture seule : ce que la suppression ferait (rien n'est écrit, rien n'engage). */
export async function fetchPeriodDeletionPreview(
  accountId: string,
  periodId: string,
): Promise<PeriodDeletionPreview> {
  const { data } = await apiClient.get<PeriodDeletionPreview>(
    `/${accountId}/periods/${periodId}/deletion-preview`,
  );
  return data;
}
