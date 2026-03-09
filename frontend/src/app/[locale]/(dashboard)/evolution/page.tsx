'use client';

import { EvolutionChart } from "@/features/reporting/ui/evolution-chart";
import { SankeyChart } from "@/features/reporting/ui/sankey-chart";
import { PeriodComparison } from "@/features/reporting/ui/period-comparison";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useTranslations } from 'next-intl';

export default function EvolutionPage() {
  const t = useTranslations('Reporting');
  const { activeAccountId, activePeriodId } = useAccountStore();

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">{t('evolution_title')}</h2>
        <p className="text-muted-foreground">
          {t('evolution_desc')}
        </p>
      </div>

      <div className="space-y-12">
        <EvolutionChart />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SankeyChart accountId={activeAccountId} periodId={activePeriodId} />
          <PeriodComparison accountId={activeAccountId} periodId={activePeriodId} />
        </div>
      </div>
    </div>
  );
}
