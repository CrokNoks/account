import { formatLongDateOnly } from '@/shared/lib/date-only';
import { PeriodDeletionPreview } from './types';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Texte de confirmation : nombres et dates seulement (jamais de montant ni de libellé). */
export function deleteConfirmation(t: Translate, preview: PeriodDeletionPreview, locale: string): string {
  const day = (value: string) => formatLongDateOnly(value, locale);
  const lines = [
    t('confirm_delete'),
    t('confirm_delete_pending', { count: preview.removedPending }),
    t('confirm_delete_kept', { count: preview.keptTransactions }),
  ];
  const { reopen } = preview;
  if (reopen) {
    lines.push(
      reopen.endDate
        ? t('confirm_delete_reopen', { start: day(reopen.startDate), end: day(reopen.endDate) })
        : t('confirm_delete_reopen_open', { start: day(reopen.startDate) }),
    );
  }
  return lines.join('\n\n');
}
