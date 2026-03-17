'use client';

import { usePeriodComparison } from '../api/use-period-comparison';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { formatCurrency } from '@/shared/lib/format';
import { cn } from '@/lib/utils';

export function MonthlyPulseWidget() {
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  
  // Find the previous period to compare with
  const sortedPeriods = periods?.sort((a, b) => b.startDate.localeCompare(a.startDate)) || [];
  const currentIndex = sortedPeriods.findIndex(p => p.id === activePeriodId);
  const previousPeriod = currentIndex !== -1 ? sortedPeriods[currentIndex + 1] : null;

  const { data: comparison, isLoading } = usePeriodComparison(
    activeAccountId, 
    activePeriodId, 
    previousPeriod?.id || null
  );

  if (isLoading) return <div className="h-32 bg-muted animate-pulse rounded-xl" />;
  if (!comparison) return null;

  // Calculate global pulse (Expense comparison)
  const totalExpenseA = comparison.expenses.reduce((sum, item) => sum + BigInt(item.period1Real), BigInt(0));
  const totalExpenseB = comparison.expenses.reduce((sum, item) => sum + BigInt(item.period2Real), BigInt(0));
  
  const diff = totalExpenseB + totalExpenseA; // Expenses are negative
  let percentage = 0;
  if (totalExpenseA !== BigInt(0)) {
    percentage = Math.round(Number((diff * BigInt(-100)) / totalExpenseA));
  }

  const isMoreExpensive = totalExpenseB < totalExpenseA; // Both negative, so B < A means B spent MORE

  return (
    <Card className="h-full border-2 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 bg-muted/10">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Le Pulse (vs mois dernier)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-2xl font-black">
              {formatCurrency(totalExpenseB.toString())}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
              Dépenses totales
            </p>
          </div>
          
          <div className={cn(
            "flex flex-col items-end px-3 py-2 rounded-xl border",
            !isMoreExpensive ? "bg-green-500/10 border-green-500/20 text-green-600" : "bg-red-500/10 border-red-500/20 text-red-600"
          )}>
            <div className="flex items-center gap-1 font-black text-lg leading-none">
              {!isMoreExpensive ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              {Math.abs(percentage)}%
            </div>
            <span className="text-[8px] uppercase font-black mt-1">
              {!isMoreExpensive ? "Économie" : "Surplus"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
