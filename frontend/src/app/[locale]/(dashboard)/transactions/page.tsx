'use client';

import { TransactionList } from "@/features/transactions/ui/transaction-list";
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { FileUp, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/shared/model/use-ui-store";

export default function TransactionsPage() {
  const t = useTranslations('Transactions');
  const setCreateTransactionDrawerOpen = useUiStore((state) => state.setCreateTransactionDrawerOpen);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/transactions/import">
            <Button variant="outline" className="gap-2">
              <FileUp className="w-4 h-4" />
              Import CSV
            </Button>
          </Link>
          <Button className="hidden lg:flex gap-2 px-4" onClick={() => setCreateTransactionDrawerOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>{t('add_transaction')}</span>
          </Button>
        </div>
      </div>

      <TransactionList />
    </div>
  );
}
