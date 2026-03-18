'use client';

import * as React from 'react';
import { format, isSameDay, isSameMonth, isToday } from 'date-fns';
import { formatCurrency } from '@/shared/lib/format';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../../model/types';
import { Category } from '@/features/categories/model/types';

interface CalendarGridProps {
  days: Date[];
  view: 'month' | 'week';
  monthStart: Date;
  selectedDay: Date | null;
  onDayClick: (day: Date) => void;
  getDayEvents: (day: Date) => CalendarEvent[];
  getDayTotal: (events: CalendarEvent[]) => bigint;
  categories?: Category[];
}

export function CalendarGrid({
  days,
  view,
  monthStart,
  selectedDay,
  onDayClick,
  getDayEvents,
  getDayTotal,
  categories
}: CalendarGridProps) {
  return (
    <>
      <div className="grid grid-cols-7 border-b bg-muted/5">
        {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((day) => (
          <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

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
              onClick={() => onDayClick(day)}
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
    </>
  );
}
