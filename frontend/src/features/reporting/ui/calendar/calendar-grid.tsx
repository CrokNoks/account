'use client';

import * as React from 'react';
import { format, isSameDay, isSameMonth, isToday, type Locale } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { CalendarEvent } from '../../model/types';
import { Category } from '@/features/categories/model/types';
import { useFormatSignedAmount } from '../../lib/signed-amount';

interface CalendarGridProps {
  days: Date[];
  view: 'month' | 'week';
  monthStart: Date;
  selectedDay: Date | null;
  onDayClick: (day: Date) => void;
  getDayEvents: (day: Date) => CalendarEvent[];
  getDayTotal: (events: CalendarEvent[]) => bigint;
  categories?: Category[];
  lowPointDate?: string | null;
  dateLocale: Locale;
}

export function CalendarGrid({
  days,
  view,
  monthStart,
  selectedDay,
  onDayClick,
  getDayEvents,
  getDayTotal,
  categories,
  lowPointDate = null,
  dateLocale,
}: CalendarGridProps) {
  const formatSignedAmount = useFormatSignedAmount();
  const t = useTranslations('Reporting.calendar');
  const maxChips = view === 'week' ? 15 : 3;
  return (
    <div className="overflow-x-auto">
      <div className={cn('grid grid-cols-7 gap-0.5', view === 'week' && 'min-w-[490px]')}>
        {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => (
          <span key={day} className="px-1.5 py-0.5 text-sm text-muted-foreground">
            {t(`weekdays.${day}`)}
          </span>
        ))}

        {days.map((day) => {
          const dayEvents = getDayEvents(day);
          const dayTotal = getDayTotal(dayEvents);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const dayIsToday = isToday(day);
          const isLowPoint = lowPointDate !== null && format(day, 'yyyy-MM-dd') === lowPointDate;
          const hasPlanned = dayEvents.some((e) => e.type === 'recurring');
          const label = `${format(day, 'PPPP', { locale: dateLocale })}${dayTotal !== BigInt(0) ? `, ${formatSignedAmount(dayTotal)}` : ''}`;

          return (
            <button
              type="button"
              key={day.toString()}
              aria-label={label}
              onClick={() => onDayClick(day)}
              className={cn(
                'flex flex-col gap-1 rounded-md border-2 p-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary',
                view === 'month' ? 'min-h-16' : 'min-h-[320px]',
                dayEvents.length > 0 ? 'bg-muted' : 'bg-transparent',
                hasPlanned ? 'border-dashed' : 'border-solid',
                dayIsToday ? 'border-primary' : dayEvents.length > 0 ? 'border-foreground/40' : 'border-transparent',
                view === 'month' && !isCurrentMonth && 'opacity-80',
                isSelected && 'ring-2 ring-primary/40',
              )}
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span className={cn('font-mono text-sm tabular-nums', dayIsToday ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                  {format(day, 'd')}
                </span>
                {isLowPoint && <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-warn" />}
              </span>

              {dayTotal !== BigInt(0) && (
                <span
                  className={cn(
                    'text-right font-mono text-xs font-medium tabular-nums',
                    view === 'month' && 'max-lg:hidden',
                    dayTotal > BigInt(0) && 'text-primary',
                  )}
                >
                  {formatSignedAmount(dayTotal)}
                </span>
              )}
              {dayTotal !== BigInt(0) && view === 'month' && (
                <span aria-hidden className={cn('self-end font-mono text-xs lg:hidden', dayTotal > BigInt(0) && 'text-primary')}>
                  {dayTotal > BigInt(0) ? '+' : '-'}
                </span>
              )}

              {view === 'week' && (
                <span className="flex flex-col gap-1">
                  {dayEvents.slice(0, maxChips).map((event) => (
                    <span
                      key={event.id}
                      data-kind={event.type}
                      className={cn(
                        'flex flex-col gap-0.5 rounded-md border bg-card px-1.5 py-1 text-xs',
                        event.type === 'recurring' ? 'border-dashed border-foreground/50' : 'border-solid border-foreground/30',
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: categories?.find((c) => c.id === event.categoryId)?.color || '#94a3b8' }}
                        />
                        <span className="truncate">{event.description}</span>
                      </span>
                      <span className={cn('font-mono tabular-nums', BigInt(event.amount) > BigInt(0) && 'text-primary')}>
                        {formatSignedAmount(event.amount)}
                      </span>
                    </span>
                  ))}
                  {dayEvents.length > maxChips && (
                    <span className="py-1 text-center text-xs italic text-muted-foreground">
                      + {dayEvents.length - maxChips} {t('others')}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
