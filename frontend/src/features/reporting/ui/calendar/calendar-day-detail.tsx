'use client';

import * as React from 'react';
import { format, type Locale } from 'date-fns';
import { Calendar as CalendarIcon, Info } from 'lucide-react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/shared/lib/format';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { CalendarEvent } from '../../model/types';
import { Category } from '@/features/categories/model/types';

interface CalendarDayDetailProps {
  selectedDay: Date | null;
  onClose: () => void;
  dayEvents: CalendarEvent[];
  dayTotal: bigint;
  dateLocale: Locale;
  categories?: Category[];
}

export function CalendarDayDetail({
  selectedDay,
  onClose,
  dayEvents,
  dayTotal,
  dateLocale,
  categories
}: CalendarDayDetailProps) {
  const t = useTranslations('Reporting.calendar');
  return (
    <Sheet open={!!selectedDay} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-md p-0">
        {selectedDay && (
          <>
            <SheetHeader className="p-6 border-b">
              <SheetTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                {format(selectedDay, 'eeee d MMMM', { locale: dateLocale })}
              </SheetTitle>
            </SheetHeader>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-muted/10 space-y-1">
                  <span className="text-[10px] max-lg:text-xs font-bold text-muted-foreground uppercase">{t('day_balance')}</span>
                  <div className={cn(
                    "text-xl font-black",
                    dayTotal < BigInt(0) ? "text-red-500" : "text-green-500"
                  )}>
                    {formatCurrency(dayTotal.toString())}
                  </div>
                </div>
                <div className="p-4 rounded-xl border bg-muted/10 space-y-1">
                  <span className="text-[10px] max-lg:text-xs font-bold text-muted-foreground uppercase">{t('operations')}</span>
                  <div className="text-xl font-black">
                    {dayEvents.length}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                  {t('movements_detail')}
                </h3>
                <div className="space-y-2">
                  {dayEvents.length === 0 ? (
                    <div className="text-center py-12 border rounded-xl border-dashed bg-muted/5">
                      <p className="text-sm text-muted-foreground italic">{t('no_movement')}</p>
                    </div>
                  ) : (
                    dayEvents.map((event) => (
                      <div 
                        key={event.id} 
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-colors",
                          event.type === 'recurring' ? "bg-muted/20 border-dashed" : "bg-card shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: categories?.find(c => c.id === event.categoryId)?.color || '#94a3b8' }} 
                          />
                          <div>
                            <p className="text-sm font-bold leading-none">{event.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-[9px] max-lg:text-xs py-0 px-1.5 h-4 font-normal">
                                {event.type === 'recurring' ? t('forecast') : t('real')}
                              </Badge>
                              <span className="text-[10px] max-lg:text-xs text-muted-foreground">
                                {categories?.find(c => c.id === event.categoryId)?.name || t('no_category')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className={cn(
                          "text-sm font-black tracking-tight",
                          BigInt(event.amount) < BigInt(0) ? "text-red-500" : "text-green-500"
                        )}>
                          {formatCurrency(event.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {dayEvents.some(e => e.type === 'recurring') && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex gap-3 items-start">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] max-lg:text-xs text-primary/80 leading-relaxed italic">
                    {t('forecast_note')}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
