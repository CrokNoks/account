'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/shared/lib/format";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useBudgetBreakdown, BudgetCategoryBreakdown } from "../api/use-budget-breakdown";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <div className="flex flex-col gap-4">
      {title}
      <Tabs defaultValue="expenses" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-4">
        <TabsTrigger value="expenses">{t('expenses')}</TabsTrigger>
        <TabsTrigger value="income">{t('income')}</TabsTrigger>
        <TabsTrigger value="savings">{t('savings')}</TabsTrigger>
        <TabsTrigger value="transfers">{t('transfers')}</TabsTrigger>
      </TabsList>
      
      <TabsContent value="expenses">
        <BudgetGroup title={t('expenses')} items={breakdown.expenses} isExpense />
      </TabsContent>
      <TabsContent value="income">
        <BudgetGroup title={t('income')} items={breakdown.income} />
      </TabsContent>
      <TabsContent value="savings">
        <BudgetGroup title={t('savings')} items={breakdown.savings} isExpense />
      </TabsContent>
      <TabsContent value="transfers">
        <BudgetGroup title={t('transfers')} items={breakdown.transfers} />
      </TabsContent>
      </Tabs>
    </div>
  );
}

function BudgetGroup({ title, items, isExpense }: { title: string, items: BudgetCategoryBreakdown[], isExpense?: boolean }) {
  const t = useTranslations('Reporting');
  if (items.length === 0) return (
    <Card>
      <CardContent className="h-32 flex items-center justify-center text-muted-foreground italic">
        Aucune donnée pour cette catégorie
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 max-h-[400px] overflow-y-auto">
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
      </CardContent>
    </Card>
  );
}
