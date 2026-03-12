'use client';

import { useCashflowForecast } from '../api/use-cashflow-forecast';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from '@/shared/lib/format';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, TrendingUp, Calendar, ArrowRight, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CashflowForecastProps {
  accountId: string | null;
}

export function CashflowForecast({ accountId }: CashflowForecastProps) {
  const { data, isLoading } = useCashflowForecast(accountId);

  if (!accountId) return null;

  const getDayLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Aujourd'hui";
    if (isTomorrow(date)) return "Demain";
    return format(date, 'dd MMMM yyyy', { locale: fr });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Solde Actuel</span>
            </div>
            <div className="text-2xl font-bold">
              {data ? formatCurrency(data.currentBalance) : '...'}
            </div>
          </CardContent>
        </Card>

        {data?.events.length && (
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium uppercase tracking-wider">Projection à 90j</span>
              </div>
              <div className="text-2xl font-bold text-emerald-700">
                {formatCurrency(data.events[data.events.length - 1].projectedBalance)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Échéancier de trésorerie
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.events.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
              Aucune opération récurrente configurée pour les prévisions.
            </div>
          ) : (
            <div className="relative space-y-0 pb-4">
              {/* Timeline Line */}
              <div className="absolute left-[17px] top-2 bottom-0 w-px bg-muted" />

              {data.events.map((event, idx) => {
                const amount = parseInt(event.amount, 10);
                const isPositive = amount > 0;

                return (
                  <div key={idx} className="relative pl-10 pb-8 last:pb-0">
                    {/* Dot */}
                    <div className={cn(
                      "absolute left-0 top-1.5 w-[35px] h-[35px] rounded-full border-4 border-background flex items-center justify-center z-10",
                      isPositive ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    )}>
                      <ArrowRight className="w-4 h-4" />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-muted/50 pb-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">
                          {getDayLabel(event.date)}
                        </p>
                        <p className="text-sm font-semibold truncate">{event.description}</p>
                      </div>

                      <div className="flex items-center gap-6 text-right shrink-0">
                        <div className="flex flex-col items-end">
                          <span className={cn("text-sm font-bold", isPositive ? "text-emerald-600" : "text-rose-600")}>
                            {isPositive ? '+' : ''}{formatCurrency(event.amount)}
                          </span>
                        </div>
                        <div className="flex flex-col items-end bg-muted/30 px-3 py-1 rounded-md min-w-[100px]">
                          <span className="text-[10px] text-muted-foreground leading-none mb-1">Solde estimé</span>
                          <span className="text-xs font-mono font-bold leading-none">
                            {formatCurrency(event.projectedBalance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
