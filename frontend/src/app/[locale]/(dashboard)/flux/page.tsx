'use client';

import { useTranslations } from 'next-intl';
import { PeriodComparison } from "@/features/reporting/ui/period-comparison";
import { useAccountStore } from "@/features/accounts/model/use-account-store";

export default function FluxPage() {
  const t = useTranslations('Reporting.flux');
  const { activeAccountId, activePeriodId } = useAccountStore();

  return (
    <div className="flex flex-col gap-4 lg:gap-12">
      <div className="flex flex-col gap-2 max-lg:hidden">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">
          {t('desc')}
        </p>
      </div>

      <PeriodComparison accountId={activeAccountId} periodId={activePeriodId} />
    </div>
  );
}
