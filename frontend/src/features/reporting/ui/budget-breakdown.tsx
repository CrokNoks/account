'use client';

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { formatPercent } from "@/shared/lib/format";
import { useFormatCurrency } from "@/shared/lib/use-format-currency";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useBudgetBreakdown } from "../api/use-budget-breakdown";
import { budgetBarClass } from "../lib/signed-amount";
import { isSurplus as isSurplusAmount } from "../lib/budget-surplus";
import { overrunAmount } from "../model/current-overruns";
import { BudgetCategoryBreakdown } from "../model/types";
import { useLocale, useTranslations } from "next-intl";
import { PieChart } from "lucide-react";

import { NoDataState } from "@/shared/ui/no-data-state";

const abs = (value: bigint): bigint => (value < BigInt(0) ? -value : value);

export function BudgetBreakdown() {
  const t = useTranslations('Reporting');
  const { activeAccountId, activePeriodId } = useAccountStore();
  
  const { data: breakdown, isLoading } = useBudgetBreakdown(
    activeAccountId, 
    activePeriodId
  );

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  const header = (
    <CardHeader className="bg-muted/10 pb-3 shrink-0">
      <div className="flex items-center gap-2">
        <PieChart className="w-4 h-4 text-primary" />
        <h2 className="text-base font-semibold">{t('variable_budgets')}</h2>
      </div>
    </CardHeader>
  );

  if (!breakdown) {
    return (
      <Card className="border-2 shadow-sm h-full overflow-hidden flex flex-col">
        {header}
        <CardContent className="flex-1 flex items-center justify-center">
          <NoDataState title={t('no_data_title')} description={t('no_data_desc')} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 shadow-sm h-full overflow-hidden flex flex-col">
      {header}
      <CardContent className="pt-2 flex-1 min-h-0 flex flex-col gap-4 pb-4">
        <div data-testid="variable-budgets" className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          <BudgetGroup title={t('expenses')} items={breakdown.expenses} isExpense />
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetGroup({ title, items, isExpense }: { title: string, items: BudgetCategoryBreakdown[], isExpense?: boolean }) {
  const formatCurrency = useFormatCurrency();
  const t = useTranslations('Reporting');
  const locale = useLocale();
  if (items.length === 0) return (
    <div className="h-32 flex items-center justify-center text-muted-foreground italic bg-muted/5 rounded-xl border border-dashed text-xs">
      {t('no_data_for', { title: title.toLowerCase() })}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-2 -mr-2">
        {items.map((item) => {
          // remaining < 0 means the budget is exceeded (expense, saving or income alike)
          const remaining = BigInt(item.remaining);
          const overrun = overrunAmount(item);
          const real = BigInt(item.real);
          const budget = BigInt(item.budget);
          // Without budget the API returns 0 %: an amount spent or received
          // on a 0 budget fills the whole bar.
          // Une dépense au réel positif (remboursement) est un excédent : rien de dépensé, pas de barre.
          const isSurplus = !!isExpense && isSurplusAmount(real);
          const unbudgeted = budget === BigInt(0) && real !== BigInt(0) && !isSurplus;
          const percentage = isSurplus ? 0 : unbudgeted ? 100 : Math.min(Math.abs(item.percentage), 100);

          // Expense real is negative and budget positive: compare absolute values.
          // Orange only when an expense or saving budget is exceeded; otherwise the blue accent.
          const variant = budgetBarClass(!!isExpense && !isSurplus && abs(real) > abs(budget));

          return (
            <div key={item.categoryId} className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="truncate pr-4">{item.name}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {isSurplus ? formatCurrency(BigInt(0)) : formatCurrency(abs(real))} / {formatCurrency(abs(budget))}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                 <div 
                    data-testid="budget-bar"
                    className={`h-full transition-all ${variant}`} 
                    style={{ width: `${percentage}%` }}
                 />
              </div>
              <div className="flex justify-between text-[10px] max-lg:text-xs text-muted-foreground uppercase tracking-wider">
                <span>{formatPercent(isSurplus ? 0 : item.percentage, locale)}</span>
                {isSurplus ? (
                  <span data-testid="surplus" className="text-foreground font-bold">
                    {t('surplus_expense', { amount: formatCurrency(real) })}
                  </span>
                ) : overrun > BigInt(0) ? (
                  <span
                    data-testid="over-budget"
                    className={isExpense ? "text-warn font-bold" : "text-foreground font-bold"}
                  >
                    {t(isExpense ? 'over_budget_expense' : 'over_budget_income', {
                      amount: formatCurrency(overrun),
                    })}
                  </span>
                ) : (
                  <span>{t('remaining')}: {formatCurrency(remaining)}</span>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
