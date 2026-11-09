'use client';

import { useLocale } from 'next-intl';
import { formatShortDate } from '@/shared/lib/date-only';

/** En-tête d'un jour de la liste d'opérations : date courte selon la langue, sans total. */
export function DayHeading({ date, as: Tag = 'h3', className }: { date: string; as?: 'h3' | 'span'; className?: string }) {
  const locale = useLocale();
  return (
    <Tag data-testid="day-heading" className={className ?? 'text-sm font-semibold text-muted-foreground'}>
      {formatShortDate(date, locale)}
    </Tag>
  );
}
