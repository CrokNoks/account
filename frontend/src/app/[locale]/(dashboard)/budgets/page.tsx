'use client';

import { CreatePeriodDialog } from "@/features/periods/ui/create-period-dialog";
import { PeriodList } from "@/features/periods/ui/period-list";
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';

export default function PeriodsPage() {
  const t = useTranslations('Budgets');
  const tf = useTranslations('BudgetTemplates');

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex items-center justify-between max-lg:justify-end">
        <div className="flex flex-col gap-2 max-lg:hidden">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/budgets/fixed">
            <Button variant="outline">{tf('link')}</Button>
          </Link>
          <CreatePeriodDialog />
        </div>
      </div>

      <PeriodList />
    </div>
  );
}
