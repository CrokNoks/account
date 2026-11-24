'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatShortRange, todayDateOnly } from '@/shared/lib/date-only';
import { periodEnd } from '@/features/periods/model/period-end';
import type { Period } from '@/features/periods/model/types';
import { periodProgress } from '../model/period-progress';

/**
 * « 1 nov. → 30 nov. · jour 24 sur 30 » : période choisie en dates courtes. Le jour n'est écrit que pour
 * une période en cours avec une fin (celle de `periodEnd`) ; sans fin, seul le début s'affiche.
 */
export function PeriodSubtitle({ period, className, testId = 'period-subtitle' }: {
  period: Pick<Period, 'startDate' | 'endDate' | 'estimatedEndDate'> | undefined;
  className?: string;
  testId?: string;
}) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  if (!period) return null;
  const end = periodEnd(period);
  const progress = periodProgress(period.startDate, end, todayDateOnly());
  const range = formatShortRange(period.startDate, end, locale);
  return (
    <span data-testid={testId} className={className}>
      {progress ? `${range} · ${t('period_day_inline', { day: progress.day, total: progress.total })}` : range}
    </span>
  );
}
