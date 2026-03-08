'use client';

import { CreatePeriodDialog } from "@/features/periods/ui/create-period-dialog";
import { PeriodList } from "@/features/periods/ui/period-list";
import { useTranslations } from 'next-intl';

export default function PeriodsPage() {
  const t = useTranslations('Budgets');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <CreatePeriodDialog />
      </div>

      <PeriodList />
    </div>
  );
}
