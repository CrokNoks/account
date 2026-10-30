'use client';

import { useTranslations } from 'next-intl';
import { CashflowForecast } from "@/features/reporting/ui/cashflow-forecast";
import { useAccountStore } from "@/features/accounts/model/use-account-store";

export default function CashflowPage() {
  const t = useTranslations('Reporting.cashflow');
  const { activeAccountId } = useAccountStore();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">{t('page_title')}</h2>
        <p className="text-muted-foreground">
          {t('page_desc')}
        </p>
      </div>

      <CashflowForecast accountId={activeAccountId} />
    </div>
  );
}
