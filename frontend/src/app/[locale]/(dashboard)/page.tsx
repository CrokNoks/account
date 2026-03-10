'use client';

import { DashboardStats } from "@/features/reporting/ui/dashboard-stats";
import { BudgetBreakdown } from "@/features/reporting/ui/budget-breakdown";
import { AIInsightsCard } from "@/features/reporting/ui/ai-insights-card";
import { CreateTransactionDrawer } from "@/features/transactions/ui/create-transaction-drawer";
import { TransactionList } from "@/features/transactions/ui/transaction-list";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { usePeriods } from "@/features/budgets/api/use-periods";
import { useUiStore } from "@/shared/model/use-ui-store";
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useEffect } from 'react';

export default function Home() {
  const t = useTranslations('Dashboard');
  const tt = useTranslations('Transactions');
  const { activeAccountId, activePeriodId, setActivePeriodId } = useAccountStore();
  const { isCreateTransactionDrawerOpen, setCreateTransactionDrawerOpen } = useUiStore();
  const { data: periods } = usePeriods(activeAccountId);
  
  // Auto-select active period on first load if nothing selected
  useEffect(() => {
    if (periods && periods.length > 0 && !activePeriodId) {
      const active = periods.find(p => p.isActive);
      if (active) setActivePeriodId(active.id);
      else setActivePeriodId(periods[0].id);
    }
  }, [periods, activePeriodId, setActivePeriodId]);

  // Handle Enter key to open transaction drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not already open and not in an input
      if (isCreateTransactionDrawerOpen) return;
      
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.hasAttribute('contenteditable')
      ) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        setCreateTransactionDrawerOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateTransactionDrawerOpen, setCreateTransactionDrawerOpen]);

  const currentPeriod = periods?.find(p => p.id === activePeriodId);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
            
            <Select value={activePeriodId || ""} onValueChange={setActivePeriodId}>
              <SelectTrigger className="h-8 rounded-full bg-primary/10 text-primary border-primary/20 px-4 hover:bg-primary/20 transition-colors">
                <SelectValue>
                  {currentPeriod 
                    ? `${format(new Date(currentPeriod.startDate), 'dd/MM/yyyy')} - ${format(new Date(currentPeriod.endDate), 'dd/MM/yyyy')}`
                    : "Sélectionner une période"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periods?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {format(new Date(p.startDate), 'dd/MM/yyyy')} - {format(new Date(p.endDate), 'dd/MM/yyyy')} {p.isActive && "(Active)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-muted-foreground">
            {t('welcome')}
          </p>
        </div>
        <CreateTransactionDrawer />
      </div>
      
      <DashboardStats />

      <AIInsightsCard accountId={activeAccountId} periodId={activePeriodId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{t('breakdown')}</h2>
          <BudgetBreakdown />
        </div>
        
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{tt('title')}</h2>
          <TransactionList periodId={activePeriodId || undefined} compact />
        </div>
      </div>
    </div>
  );
}
