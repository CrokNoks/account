'use client';

import { useCalendarData } from '../api/use-calendar-data';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/shared/lib/format';
import { Clock, CalendarDays } from 'lucide-react';
import { format, isAfter, startOfDay, addDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function UpcomingDeadlinesWidget() {
  const { activeAccountId } = useAccountStore();
  
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  
  const { data: events, isLoading } = useCalendarData(activeAccountId, year, month);

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;
  
  // Filter for upcoming events in the next 7 days
  const now = startOfDay(new Date());
  const next7Days = addDays(now, 7);
  
  const upcoming = events
    ?.filter(e => {
      const date = parseISO(e.date);
      return isAfter(date, now) && !isAfter(date, next7Days);
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <Card className="h-full border-2 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 bg-muted/10">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Prochaines Échéances (7j)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {!upcoming || upcoming.length === 0 ? (
            <div className="h-24 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <CalendarDays className="w-8 h-8 opacity-20" />
              <p className="text-xs italic">Rien de prévu cette semaine</p>
            </div>
          ) : (
            upcoming.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
                    <span className="text-[10px] uppercase font-bold">{format(parseISO(event.date), 'EEE', { locale: fr })}</span>
                    <span className="text-sm font-black leading-none">{format(parseISO(event.date), 'd')}</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate">{event.description}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                      {event.type === 'recurring' ? 'Récurrent' : 'Prévu'}
                    </span>
                  </div>
                </div>
                <span className={cn(
                  "text-xs font-black tracking-tight shrink-0",
                  parseInt(event.amount, 10) < 0 ? "text-red-500" : "text-green-500"
                )}>
                  {formatCurrency(event.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
