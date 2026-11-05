'use client';

import { useTranslations } from 'next-intl';
import { BudgetTemplatesForm } from '@/features/periods/ui/budget-templates-form';

export default function FixedBudgetsPage() {
  const t = useTranslations('BudgetTemplates');

  return (
    <div className="flex flex-col gap-4 lg:gap-8 max-w-2xl">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      <BudgetTemplatesForm />
    </div>
  );
}
