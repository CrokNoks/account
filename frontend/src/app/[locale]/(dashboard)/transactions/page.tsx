'use client';

import { TransactionList } from "@/features/transactions/ui/transaction-list";
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { FileUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useEffect } from 'react';
import { useUiStore } from '@/shared/model/use-ui-store';
import { HelpButton } from '@/shared/ui/tour/HelpButton';

export default function TransactionsPage() {
  const t = useTranslations('Transactions');
  const { startTour, completedTours } = useUiStore();

  useEffect(() => {
    if (completedTours['dashboard'] && !completedTours['transactions']) {
      const timer = setTimeout(() => {
        startTour('transactions');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedTours, startTour]);

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex items-center gap-2">
        <p className="text-muted-foreground max-lg:hidden">
          {t('description')}
        </p>
        <HelpButton tour="transactions" className="h-8 w-8" />
      </div>

      <TransactionList 
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
