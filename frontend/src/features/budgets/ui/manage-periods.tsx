'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { CreatePeriodDialog } from '@/features/periods/ui/create-period-dialog';
import { PeriodList } from '@/features/periods/ui/period-list';

/** Zone « Gérer les périodes » : créer, modifier les dates, clôturer, supprimer, et les montants par défaut. */
export function ManagePeriods() {
  const t = useTranslations('BudgetsScreen');
  const tf = useTranslations('BudgetTemplates');

  return (
    <details data-testid="manage-periods" className="group rounded-xl border-2 p-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
        {t('manage_periods')}
      </summary>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/budgets/fixed">
            <Button variant="outline" className="min-h-11">{tf('link')}</Button>
          </Link>
          <CreatePeriodDialog />
        </div>
        <PeriodList />
      </div>
    </details>
  );
}
