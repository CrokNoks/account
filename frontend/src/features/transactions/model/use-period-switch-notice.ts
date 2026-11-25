'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import { formatDateOnly } from '@/shared/lib/date-only';
import { extractPeriodSwitch } from './period-switch';

/**
 * Message de confirmation d'une bascule de période déclenchée par le serveur :
 * période clôturée, période ouverte (dates) et, à la sortie du pending, la date
 * du jour prise par la transaction. À appeler avec la réponse de l'API ; sans
 * bascule dans la réponse, ne fait rien.
 */
export function usePeriodSwitchNotice(): (response: unknown) => void {
  const t = useTranslations('Transactions');
  const locale = useLocale();

  return useCallback((response: unknown) => {
    const periodSwitch = extractPeriodSwitch(response);
    if (!periodSwitch) return;
    const { closed, opened, count, dateChanged, removedPending, remainingPending } = periodSwitch;
    const dates = {
      closedStart: formatDateOnly(closed.startDate, locale),
      closedEnd: formatDateOnly(closed.endDate, locale),
      openedStart: formatDateOnly(opened.startDate, locale),
      openedEnd: formatDateOnly(opened.endDate, locale),
    };
    const details = [
      dateChanged ? t('period_switch_date_today') : null,
      removedPending ? t('period_switch_removed_pending', { removed: removedPending }) : null,
      remainingPending ? t('period_switch_remaining_pending', { remaining: remainingPending }) : null,
    ].filter(Boolean);
    toast.success(
      count > 1 ? t('period_switch_many', { count, ...dates }) : t('period_switch', dates),
      details.length > 0 ? { description: details.join(' ') } : undefined,
    );
  }, [t, locale]);
}
