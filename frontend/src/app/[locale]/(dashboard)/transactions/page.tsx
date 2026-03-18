'use client';

import { TransactionList } from "@/features/transactions/ui/transaction-list";
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { FileUp } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function TransactionsPage() {
  const t = useTranslations('Transactions');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <TransactionList 
        extraActions={
          <Link href="/transactions/import">
            <Button variant="outline" size="sm" className="gap-2">
              <FileUp className="w-4 h-4" />
              <span className="hidden sm:inline">Import CSV</span>
            </Button>
          </Link>
        }
      />
    </div>
  );
}
