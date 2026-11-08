'use client';

import { format, isBefore, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { cn } from '@/lib/utils';
import { useCalendarData } from '../api/use-calendar-data';
import { usePresentAmount } from '../lib/signed-amount';

/** Liste des échéances d'aujourd'hui et des jours suivants du mois affiché. */
export function EcheancesUpcomingList({ currentDate }: { currentDate: Date }) {
  const present = usePresentAmount();
  const t = useTranslations('Reporting.echeances');
  const dateLocale = useLocale() === 'fr' ? fr : enUS;
  const { activeAccountId } = useAccountStore();
  const { data: events, isLoading, isError } = useCalendarData(activeAccountId, currentDate.getFullYear(), currentDate.getMonth() + 1);

  const today = startOfDay(new Date());
  const monthName = format(currentDate, 'LLLL', { locale: dateLocale });
  const isPastMonth = isBefore(startOfMonth(currentDate), startOfMonth(today));

  const items = isPastMonth
    ? []
    : (events ?? [])
        .filter((e) => !isBefore(parseISO(e.date), today))
        .sort((a, b) => a.date.localeCompare(b.date));

  const stateLabel = (e: (typeof items)[number]) =>
    e.type === 'recurring' ? t('state_planned') : e.pending ? t('state_pending') : t('state_real');

  return (
    <section aria-labelledby="echeances-list-title" className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 lg:p-5">
      <h2 id="echeances-list-title" className="mb-1 text-base font-semibold">
        {t('list_title', { month: monthName })}
      </h2>

      {isError ? (
        <p role="alert" className="rounded-lg border border-warn/40 p-3 text-sm text-warn">{t('list_error')}</p>
      ) : isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      ) : isPastMonth ? (
        <p className="py-3 text-sm text-muted-foreground">{t('list_past_month', { month: monthName })}</p>
      ) : items.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">{t('list_none', { month: monthName })}</p>
      ) : (
        <ul>
          {items.map((e) => (
            <li key={e.id} className="flex min-h-11 items-center justify-between gap-3 border-t py-1">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{e.description}</span>
                <span className="text-sm text-muted-foreground">
                  {format(parseISO(e.date), 'd MMM', { locale: dateLocale })} · {stateLabel(e)}
                </span>
              </span>
              <span className={cn('whitespace-nowrap font-mono tabular-nums', present(e.amount, 'flow').className)}>
                {present(e.amount, 'flow').text}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link href="/recurring" className="flex min-h-11 items-center border-t font-medium text-primary hover:underline">
        {t('manage_recurring')}
      </Link>
    </section>
  );
}
