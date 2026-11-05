'use client';

import { useTranslations } from 'next-intl';
import { OverrunsByPeriod } from '@/features/reporting/ui/overruns-by-period';
import { CategoryOverrunsChart } from '@/features/reporting/ui/category-overruns-chart';

export default function OverrunsPage() {
  const t = useTranslations('Reporting');

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex flex-col gap-2 max-lg:hidden">
        <h2 className="text-3xl font-bold tracking-tight">{t('overruns_title')}</h2>
        <p className="text-muted-foreground">{t('overruns_desc')}</p>
      </div>

      <CategoryOverrunsChart />
      <OverrunsByPeriod />
    </div>
  );
}
