'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from '@/shared/lib/format';
import { cn } from '@/lib/utils';

interface CalendarHeaderProps {
  currentDate: Date;
  view: 'month' | 'week';
  setView: (v: 'month' | 'week') => void;
  onNext: () => void;
  onPrev: () => void;
  onToday: () => void;
  totals: { income: bigint; expenses: bigint };
  dateLocale: any;
  calendarStart: Date;
}

export function CalendarHeader({
  currentDate,
  view,
  setView,
  onNext,
  onPrev,
  onToday,
  totals,
  dateLocale,
  calendarStart
}: CalendarHeaderProps) {
  return (
    <CardHeader className="flex flex-col space-y-4 bg-muted/20 pb-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 w-full">
        <div className="flex items-center gap-4 min-w-[250px]">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold capitalize whitespace-nowrap">
              {view === 'month' 
                ? format(currentDate, 'MMMM yyyy', { locale: dateLocale })
                : `Semaine du ${format(calendarStart, 'd MMMM', { locale: dateLocale })}`
              }
            </CardTitle>
            <p className="text-xs text-muted-foreground whitespace-nowrap">Calendrier financier prévisionnel</p>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-8 px-6 py-2 bg-background/50 rounded-2xl border border-border/50">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-tighter">Reçu</span>
              <span className="text-sm font-black text-green-500">
                {formatCurrency(totals.income.toString())}
              </span>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-tighter">Dépensé</span>
              <span className="text-sm font-black text-red-500">
                {formatCurrency((totals.expenses < BigInt(0) ? -totals.expenses : totals.expenses).toString())}
              </span>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-tighter">Net</span>
              <span className={cn(
                "text-sm font-black",
                totals.income + totals.expenses >= BigInt(0) ? "text-green-500" : "text-red-500"
              )}>
                {formatCurrency((totals.income + totals.expenses).toString())}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 min-w-[250px] justify-end">
          <Tabs value={view} onValueChange={(v) => setView(v as 'month' | 'week')} className="w-auto">
            <TabsList className="grid w-[160px] grid-cols-2 h-8">
              <TabsTrigger value="month" className="text-xs">Mois</TabsTrigger>
              <TabsTrigger value="week" className="text-xs">Semaine</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onToday} className="h-8">
              Aujourd&apos;hui
            </Button>
            <div className="flex items-center border rounded-lg overflow-hidden bg-background">
              <Button variant="ghost" size="icon" onClick={onPrev} className="h-8 w-8 rounded-none border-r">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8 rounded-none">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </CardHeader>
  );
}
