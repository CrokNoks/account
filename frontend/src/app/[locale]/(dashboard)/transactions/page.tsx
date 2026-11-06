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
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { readOperationsLink } from '@/features/transactions/model/operations-link';
import { useUiStore } from '@/shared/model/use-ui-store';
import { HelpButton } from '@/shared/ui/tour/HelpButton';

// useSearchParams demande une frontière Suspense (lecture de l'URL côté client).
export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded-xl" />}>
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const link = readOperationsLink(searchParams);
  const t = useTranslations('Transactions');
  const { startTour, completedTours } = useUiStore();
  const { activeAccountId, activePeriodId, setActivePeriodId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  // « Toutes les périodes » reste propre à cet écran : la période active, partagée avec Aujourd'hui, ne change pas.
  const [allPeriods, setAllPeriods] = useState(link.allPeriods);
  // Un nouveau lien (même page, autre URL) reprend sa propre portée de période (réinitialisation pendant le rendu).
  const query = searchParams.toString();
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) {
    setSeenQuery(query);
    setAllPeriods(link.allPeriods);
  }

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

      {link.idsMissing ? (
        <div role="alert" data-testid="ids-missing" className="flex flex-col items-start gap-3 rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">{t('ids_missing')}</p>
          <Link href="/transactions">
            <Button variant="outline" size="sm">{t('back_to_full_list')}</Button>
          </Link>
        </div>
      ) : (
      <TransactionList 
        // Un autre lien (autres filtres) repart d'une liste neuve.
        key={searchParams.toString()}
        period={listPeriod}
        initialFilters={{ ids: link.ids, categoryId: link.categoryId, state: link.state }}
        extraActions={
          <Link href="/transactions/import">
            <Button variant="outline" size="sm" className="gap-2">
              <FileUp className="w-4 h-4" />
              <span className="hidden sm:inline">{t('import_csv')}</span>
            </Button>
          </Link>
        }
      />
      )}
    </div>
  );
}
