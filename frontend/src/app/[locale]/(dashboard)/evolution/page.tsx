'use client';

import { EvolutionChart } from "@/features/reporting/ui/evolution-chart";
import { useTranslations } from 'next-intl';
import { SectionTabs } from '@/shared/ui/layout/section-tabs';

export default function EvolutionPage() {
  const t = useTranslations('Reporting');

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <SectionTabs entry="/evolution" />
      <div className="flex flex-col gap-2 max-lg:hidden">
        <h2 className="text-3xl font-bold tracking-tight">{t('evolution_title')}</h2>
        <p className="text-muted-foreground">
          {t('evolution_desc')}
        </p>
      </div>

      <div className="space-y-12">
        <EvolutionChart />
      </div>
    </div>
  );
}
