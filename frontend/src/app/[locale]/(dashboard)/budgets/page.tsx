'use client';

import { useTranslations } from 'next-intl';
import { BudgetsScreen } from '@/features/budgets/ui/budgets-screen';
import { ManagePeriods } from '@/features/budgets/ui/manage-periods';

export default function BudgetsPage() {
  const t = useTranslations('Budgets');

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex flex-col gap-2 max-lg:hidden">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <BudgetsScreen />
      <ManagePeriods />
    </div>
  );
}
