'use client';

import { TransactionList } from "@/features/transactions/ui/transaction-list";
import { OperationsBalances } from "@/features/transactions/ui/operations-balances";
import { ALL_PERIODS, PeriodSelect } from "@/features/periods/ui/period-select";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { usePeriods } from "@/features/budgets/api/use-periods";
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { FileUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useEffect, useState } from 'react';
import { useUiStore } from '@/shared/model/use-ui-store';
import { HelpButton } from '@/shared/ui/tour/HelpButton';

export default function TransactionsPage() {
  const t = useTranslations('Transactions');
  const { startTour, completedTours } = useUiStore();
  const { activeAccountId, activePeriodId, setActivePeriodId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  // « Toutes les périodes » reste propre à cet écran : la période active, partagée avec Aujourd'hui, ne change pas.
  const [allPeriods, setAllPeriods] = useState(false);

  useEffect(() => {
    if (periods && periods.length > 0 && !activePeriodId) {
      setActivePeriodId((periods.find(p => p.isActive) ?? periods[0]).id);
    }
  }, [periods, activePeriodId, setActivePeriodId]);

  useEffect(() => {
    if (completedTours['dashboard'] && !completedTours['transactions']) {
      const timer = setTimeout(() => {
        startTour('transactions');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedTours, startTour]);

  const currentPeriod = periods?.find(p => p.id === activePeriodId);
  const hasPeriod = !!currentPeriod;
  const listPeriod = allPeriods || !currentPeriod ? ALL_PERIODS : currentPeriod.id;

  const handlePeriodChange = (value: string) => {
    if (value === ALL_PERIODS) {
      setAllPeriods(true);
    } else {
      setAllPeriods(false);
      setActivePeriodId(value);
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex items-center gap-2">
        <p className="text-muted-foreground max-lg:hidden">
          {t('description')}
        </p>
        <HelpButton tour="transactions" className="h-8 w-8" />
        {periods && periods.length > 0 && (
          <PeriodSelect periods={periods} value={listPeriod} onChange={handlePeriodChange} allowAll />
        )}
      </div>

      <OperationsBalances hasPeriod={hasPeriod} />

      <TransactionList 
        period={listPeriod}
        extraActions={
          <Link href="/transactions/import">
            <Button variant="outline" size="sm" className="gap-2">
              <FileUp className="w-4 h-4" />
              <span className="hidden sm:inline">{t('import_csv')}</span>
            </Button>
          </Link>
        }
      />
    </div>
  );
}
