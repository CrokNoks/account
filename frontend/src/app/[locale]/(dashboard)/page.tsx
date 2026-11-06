'use client';

import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { usePeriods } from "@/features/budgets/api/use-periods";
import { useAccounts } from "@/features/accounts/api/use-accounts";
import { useUiStore } from "@/shared/model/use-ui-store";
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { HelpButton } from "@/shared/ui/tour/HelpButton";
import { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { CalendarX, Plus } from "lucide-react";
import { NoDataState } from "@/shared/ui/no-data-state";
import { BalanceBar } from "@/features/reporting/ui/dashboard-stats";
import { ForecastComposition } from "@/features/reporting/ui/forecast-composition";
import { SpendingPace } from "@/features/reporting/ui/spending-pace";
import { ToHandle } from "@/features/reporting/ui/to-handle";
import { BudgetBreakdown } from "@/features/reporting/ui/budget-breakdown";
import { UpcomingDeadlinesWidget } from "@/features/reporting/ui/upcoming-deadlines-widget";
import { PeriodSelect } from "@/features/periods/ui/period-select";
import { CreatePeriodDialog } from "@/features/periods/ui/create-period-dialog";

export default function Home() {
  const t = useTranslations('Dashboard');
  const router = useRouter();
  const { activeAccountId, activePeriodId, setActivePeriodId } = useAccountStore();
  const { startTour, completedTours, setCreateTransactionDrawerOpen } = useUiStore();
  const { data: accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { data: periods, isLoading: isLoadingPeriods } = usePeriods(activeAccountId);

  useEffect(() => {
    if (!isLoadingAccounts && (!accounts || accounts.length === 0)) {
      router.push('/accounts');
    }
  }, [accounts, isLoadingAccounts, router]);

  useEffect(() => {
    if (periods && periods.length > 0 && !activePeriodId) {
      const active = periods.find(p => p.isActive);
      if (active) setActivePeriodId(active.id);
      else setActivePeriodId(periods[0].id);
    }
  }, [periods, activePeriodId, setActivePeriodId]);

  useEffect(() => {
    // La visite cible des blocs qui n'existent qu'avec une période : pas de visite sans période.
    const hasPeriod = !isLoadingPeriods && !!periods && periods.length > 0;
    if (hasPeriod && !completedTours['dashboard'] && completedTours['account']) {
      const timer = setTimeout(() => {
        startTour('dashboard');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedTours, startTour, periods, isLoadingPeriods]);

  // Sans aucune période, rien d'autre que l'explication et la création (ni barre, ni rythme, ni blocs).
  if (!isLoadingPeriods && periods && periods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <NoDataState icon={CalendarX} title={t('no_period_title')} description={t('no_period_desc')} />
        <CreatePeriodDialog />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h2 className="hidden lg:block text-3xl font-bold tracking-tight">{t('title')}</h2>
            <HelpButton tour="dashboard" className="h-8 w-8" />
            <PeriodSelect periods={periods} value={activePeriodId} onChange={setActivePeriodId} />
          </div>
          <p className="hidden lg:block text-muted-foreground">
            {t('welcome')}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateTransactionDrawerOpen(true)} data-tour="add-transaction">
          <Plus className="w-4 h-4" />
          {t('new_transaction')}
        </Button>
      </div>

      <BalanceBar />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
        <div className="lg:col-span-5">
          <ForecastComposition />
        </div>
        <div className="lg:col-span-7">
          <SpendingPace />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
        <div data-tour="to-handle" className="lg:col-span-12">
          <ToHandle />
        </div>
        <div data-tour="budget-breakdown" className="lg:col-span-7">
          <BudgetBreakdown />
        </div>
        <div className="lg:col-span-5">
          <UpcomingDeadlinesWidget />
        </div>
      </div>
    </div>
  );
}
