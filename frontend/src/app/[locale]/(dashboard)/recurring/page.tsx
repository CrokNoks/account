'use client';

import { RecurringTransactionList } from "@/features/recurring/ui/recurring-transaction-list";
import { CreateRecurringDialog } from "@/features/recurring/ui/create-recurring-dialog";
import { useTranslations } from 'next-intl';

export default function RecurringPage() {
  const t = useTranslations('Recurring');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <CreateRecurringDialog />
      </div>

      <RecurringTransactionList />
    </div>
  );
}
