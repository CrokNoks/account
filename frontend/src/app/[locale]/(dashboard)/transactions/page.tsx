'use client';

import { TransactionList } from "@/features/transactions/ui/transaction-list";
import { CreateTransactionDrawer } from "@/features/transactions/ui/create-transaction-drawer";
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { FileUp } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function TransactionsPage() {
  const t = useTranslations('Transactions');

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
          <CreateTransactionDrawer />
        </div>
      </div>

      <TransactionList />
    </div>
  );
}
