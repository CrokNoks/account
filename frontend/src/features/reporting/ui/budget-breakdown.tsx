'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/shared/lib/format";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { usePeriods } from "@/features/budgets/api/use-periods";
import { useBudgetBreakdown, BudgetCategoryBreakdown } from "../api/use-budget-breakdown";
import { useTranslations } from "next-intl";

export function BudgetBreakdown() {
  const t = useTranslations('Reporting');
  const { activeAccountId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  
  const activePeriod = periods?.find(p => p.isActive);
  const { data: breakdown, isLoading } = useBudgetBreakdown(
    activeAccountId, 
    activePeriod?.id || null
  );

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;
  if (!breakdown) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <BudgetGroup title={t('expenses')} items={breakdown.expenses} isExpense />
      <BudgetGroup title={t('income')} items={breakdown.income} />
      <BudgetGroup title={t('savings')} items={breakdown.savings} isExpense />
      <BudgetGroup title={t('transfers')} items={breakdown.transfers} />
    </div>
  );
}

function BudgetGroup({ title, items, isExpense }: { title: string, items: BudgetCategoryBreakdown[], isExpense?: boolean }) {
  const t = useTranslations('Reporting');
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {items.map((item) => {
          const percentage = Math.min(Math.abs(item.percentage), 100);
          
          // Simplify logic: if real is "worse" than budget
          const variant = isExpense 
            ? (parseInt(item.real, 10) < parseInt(item.budget, 10) ? "bg-red-500" : "bg-green-500")
            : (parseInt(item.real, 10) >= parseInt(item.budget, 10) ? "bg-green-500" : "bg-yellow-500");

          return (
            <div key={item.categoryId} className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>{item.name}</span>
                <span className="text-muted-foreground">
                  {formatCurrency(item.real)} / {formatCurrency(item.budget)}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                 <div 
                    className={`h-full transition-all ${variant}`} 
                    style={{ width: `${percentage}%` }}
                 />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
                <span>{item.percentage}%</span>
                <span>{t('remaining')}: {formatCurrency(item.remaining)}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
