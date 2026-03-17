'use client';

import * as React from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  parseISO,
  addWeeks,
  subWeeks
} from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCalendarData, CalendarEvent } from '../api/use-calendar-data';
import { formatCurrency } from '@/shared/lib/format';
import { cn } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from '@/components/ui/badge';
import { useCategories } from '@/features/categories/api/use-categories';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function FinancialCalendar() {
  const localeStr = useLocale();
  const dateLocale = localeStr === 'fr' ? fr : enUS;
  const { activeAccountId } = useAccountStore();
  
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [view, setView] = React.useState<'month' | 'week'>('month');
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  
  const { data: events } = useCalendarData(activeAccountId, year, month);
  const { data: categories } = useCategories(activeAccountId);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  
  const calendarStart = view === 'month' 
    ? startOfWeek(monthStart, { weekStartsOn: 1 })
    : startOfWeek(currentDate, { weekStartsOn: 1 });
    
  const calendarEnd = view === 'month'
    ? endOfWeek(monthEnd, { weekStartsOn: 1 })
    : endOfWeek(currentDate, { weekStartsOn: 1 });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const next = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };

  const prev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const getDayEvents = (day: Date) => {
    return events?.filter((e) => isSameDay(parseISO(e.date), day)) || [];
  };

  const getDayTotal = (dayEvents: CalendarEvent[]) => {
    return dayEvents.reduce((sum, e) => sum + BigInt(e.amount), BigInt(0));
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm overflow-hidden border-2">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 pb-4 bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold capitalize">
                {view === 'month' 
                  ? format(currentDate, 'MMMM yyyy', { locale: dateLocale })
                  : `Semaine du ${format(calendarStart, 'd MMMM', { locale: dateLocale })}`
                }
              </CardTitle>
              <p className="text-xs text-muted-foreground">Calendrier financier prévisionnel</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as 'month' | 'week')} className="w-auto">
              <TabsList className="grid w-[160px] grid-cols-2 h-8">
                <TabsTrigger value="month" className="text-xs">Mois</TabsTrigger>
                <TabsTrigger value="week" className="text-xs">Semaine</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday} className="h-8">
                Aujourd&apos;hui
              </Button>
              <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                <Button variant="ghost" size="icon" onClick={prev} className="h-8 w-8 rounded-none border-r">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={next} className="h-8 w-8 rounded-none">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b bg-muted/5">
            {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((day) => (
              <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className={cn(
            "grid grid-cols-7 auto-rows-fr",
            view === 'week' && "divide-x"
          )}>
            {days.map((day, i) => {
              const dayEvents = getDayEvents(day);
              const dayTotal = getDayTotal(dayEvents);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const dayIsToday = isToday(day);

              return (
                <div
                  key={day.toString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "p-2 border-r border-b group cursor-pointer transition-all hover:bg-accent/30 flex flex-col gap-1",
                    view === 'month' ? "min-h-[100px]" : "min-h-[400px] bg-background",
                    view === 'month' && !isCurrentMonth && "bg-muted/10 opacity-40",
                    i % 7 === 6 && "border-r-0",
                    isSelected && "bg-primary/5 ring-2 ring-inset ring-primary/20"
                  )}
                >
                  <div className="flex items-center justify-between border-b pb-1 mb-1 border-muted/20">
                    <span className={cn(
                      "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                      dayIsToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayTotal !== BigInt(0) && (
                      <span className={cn(
                        "text-[9px] font-black tracking-tighter",
                        dayTotal < BigInt(0) ? "text-red-500" : "text-green-500"
                      )}>
                        {formatCurrency(dayTotal.toString())}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-1 mt-1">
                    {dayEvents.slice(0, view === 'week' ? 15 : 3).map((event) => (
                      <div 
                        key={event.id} 
                        className={cn(
                          "text-[9px] px-1.5 py-1 rounded-md truncate border flex items-center gap-2",
                          event.type === 'recurring' ? "border-dashed bg-muted/30" : "bg-card shadow-sm border-muted/50"
                        )}
                      >
                        <div 
                          className="w-1.5 h-1.5 rounded-full shrink-0" 
                          style={{ backgroundColor: categories?.find(c => c.id === event.categoryId)?.color || '#94a3b8' }} 
                        />
                        <div className="flex-1 truncate flex justify-between items-center gap-1">
                          <span className="truncate">{event.description}</span>
                          {view === 'week' && (
                            <span className={cn(
                              "font-bold shrink-0",
                              BigInt(event.amount) < BigInt(0) ? "text-red-500" : "text-green-500"
                            )}>
                              {parseInt(event.amount) / 100}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {dayEvents.length > (view === 'week' ? 15 : 3) && (
                      <div className="text-[8px] text-center text-muted-foreground font-bold italic py-1">
                        + {dayEvents.length - (view === 'week' ? 15 : 3)} autres
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border bg-card shadow-sm" />
          <span>Opération réelle</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border border-dashed bg-muted/30" />
          <span>Prévision récurrente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span>Aujourd&apos;hui</span>
        </div>
      </div>

      {/* Daily detail drawer */}
      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
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
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Bilan Journée</span>
                    <div className={cn(
                      "text-xl font-black",
                      getDayTotal(getDayEvents(selectedDay)) < BigInt(0) ? "text-red-500" : "text-green-500"
                    )}>
                      {formatCurrency(getDayTotal(getDayEvents(selectedDay)).toString())}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border bg-muted/10 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Opérations</span>
                    <div className="text-xl font-black">
                      {getDayEvents(selectedDay).length}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                    Détail des mouvements
                  </h3>
                  <div className="space-y-2">
                    {getDayEvents(selectedDay).length === 0 ? (
                      <div className="text-center py-12 border rounded-xl border-dashed bg-muted/5">
                        <p className="text-sm text-muted-foreground italic">Aucun mouvement pour cette journée</p>
                      </div>
                    ) : (
                      getDayEvents(selectedDay).map((event) => (
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
                                <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4 font-normal">
                                  {event.type === 'recurring' ? 'Prévision' : 'Réel'}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {categories?.find(c => c.id === event.categoryId)?.name || 'Sans catégorie'}
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
                
                {getDayEvents(selectedDay).some(e => e.type === 'recurring') && (
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex gap-3 items-start">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] text-primary/80 leading-relaxed italic">
                      Les prévisions sont basées sur vos opérations récurrentes. Elles disparaissent automatiquement une fois l&apos;opération réelle detectée.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
