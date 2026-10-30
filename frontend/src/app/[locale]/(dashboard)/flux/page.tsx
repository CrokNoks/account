'use client';

import { useTranslations } from 'next-intl';
import { SankeyChart } from "@/features/reporting/ui/sankey-chart";
import { PeriodComparison } from "@/features/reporting/ui/period-comparison";
import { useAccountStore } from "@/features/accounts/model/use-account-store";

export default function FluxPage() {
  const t = useTranslations('Reporting.flux');
  const { activeAccountId, activePeriodId } = useAccountStore();

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">
          {t('desc')}
        </p>
      </div>

      <div className="space-y-12">
        <SankeyChart accountId={activeAccountId} periodId={activePeriodId} />
        
        <div className="grid grid-cols-1 gap-8 border-t pt-12">
          <PeriodComparison accountId={activeAccountId} periodId={activePeriodId} />
        </div>
      </div>
    </div>
  );
}
