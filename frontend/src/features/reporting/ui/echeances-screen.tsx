'use client';

import { useTranslations } from 'next-intl';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { CashflowForecast } from './cashflow-forecast';
import { FinancialCalendar } from './financial-calendar';

/**
 * Écran Échéances : courbe de trésorerie, calendrier et liste sur une même page, sans onglets.
 * Servi par `/echeances` et par les anciennes adresses `/calendar` et `/cashflow` (sans redirection).
 */
export function EcheancesScreen() {
  const t = useTranslations('Reporting.echeances');
  const { activeAccountId } = useAccountStore();

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex flex-col gap-2 max-lg:hidden">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">{t('desc')}</p>
      </div>

      {activeAccountId ? (
        <>
          <CashflowForecast accountId={activeAccountId} />
          <FinancialCalendar />
        </>
      ) : (
        <p role="status" className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          {t('no_account')}
        </p>
      )}
    </div>
  );
}
