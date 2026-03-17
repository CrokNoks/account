'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/shared/lib/format";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useBudgetBreakdown, BudgetCategoryBreakdown } from "../api/use-budget-breakdown";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart } from "lucide-react";

export function BudgetBreakdown({ title }: { title?: React.ReactNode }) {
  const t = useTranslations('Reporting');
  const { activeAccountId, activePeriodId } = useAccountStore();
  
  const { data: breakdown, isLoading } = useBudgetBreakdown(
    activeAccountId, 
    activePeriodId
  );

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;
  if (!breakdown) return null;

  return (
    <Card className="border-2 shadow-sm h-full overflow-hidden flex flex-col">
      <CardHeader className="bg-muted/10 pb-3 shrink-0">
        {title || (
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('breakdown')}</h2>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-2 flex-1 flex flex-col gap-4 min-h-0 pb-0">
        <Tabs defaultValue="expenses" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-4 mb-4 shrink-0">
        <TabsTrigger value="expenses">{t('expenses')}</TabsTrigger>
        <TabsTrigger value="income">{t('income')}</TabsTrigger>
        <TabsTrigger value="savings">{t('savings')}</TabsTrigger>
        <TabsTrigger value="transfers">{t('transfers')}</TabsTrigger>
      </TabsList>
      
      <TabsContent value="expenses" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
        <BudgetGroup title={t('expenses')} items={breakdown.expenses} isExpense />
      </TabsContent>
      <TabsContent value="income" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
        <BudgetGroup title={t('income')} items={breakdown.income} />
      </TabsContent>
      <TabsContent value="savings" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
        <BudgetGroup title={t('savings')} items={breakdown.savings} isExpense />
      </TabsContent>
      <TabsContent value="transfers" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
        <BudgetGroup title={t('transfers')} items={breakdown.transfers} />
      </TabsContent>
      </Tabs>
      </CardContent>
    </Card>
  );
}

function BudgetGroup({ title, items, isExpense }: { title: string, items: BudgetCategoryBreakdown[], isExpense?: boolean }) {
  const t = useTranslations('Reporting');
  if (items.length === 0) return (
    <div className="h-32 flex items-center justify-center text-muted-foreground italic bg-muted/5 rounded-xl border border-dashed">
      Aucune donnée pour cette catégorie
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-2 -mr-2">
        {items.map((item) => {
          const percentage = Math.min(Math.abs(item.percentage), 100);
          
          // Simplify logic: if real is "worse" than budget
          const variant = isExpense 
            ? (parseInt(item.real, 10) < parseInt(item.budget, 10) ? "bg-red-500" : "bg-green-500")
            : (parseInt(item.real, 10) >= parseInt(item.budget, 10) ? "bg-green-500" : "bg-yellow-500");

          return (
            <div key={item.categoryId} className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="truncate pr-4">{item.name}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {formatCurrency(Math.abs(parseInt(item.real, 10)).toString())} / {formatCurrency(Math.abs(parseInt(item.budget, 10)).toString())}
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
                <span>{t('remaining')}: {formatCurrency(Math.abs(parseInt(item.remaining, 10)).toString())}</span>
              </div>
            </div>
          );
        })}
    </div>
  );
}
