'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCashflowForecast } from '../api/use-cashflow-forecast';
import { CashflowForecast, type CashflowHorizon } from './cashflow-forecast';
import { EcheancesUpcomingList } from './echeances-upcoming-list';
import { FinancialCalendar } from './financial-calendar';

/**
 * Écran Échéances : courbe de trésorerie, calendrier et liste sur une même page, sans onglets.
 * Servi par `/echeances`.
 */
export function EcheancesScreen() {
  const t = useTranslations('Reporting.echeances');
  const { activeAccountId } = useAccountStore();
  // Mois (ou semaine) affiché : partagé entre le calendrier et la liste « À venir en {mois} ».
  const [currentDate, setCurrentDate] = useState(() => new Date());
  // Horizon de la courbe : le point bas marqué dans le calendrier est celui de cet horizon (valeur du back).
  const [days, setDays] = useState<CashflowHorizon>(30);
  const { data: forecast } = useCashflowForecast(activeAccountId, days);
  const lowPointDate = forecast?.lowPoint.date.slice(0, 10) ?? null;

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      {activeAccountId ? (
        <>
          <CashflowForecast accountId={activeAccountId} days={days} onDaysChange={setDays} />
          <div className="flex flex-col gap-4 lg:gap-5 xl:flex-row xl:items-start">
            <div className="min-w-0 xl:flex-[2]">
              <FinancialCalendar currentDate={currentDate} onDateChange={setCurrentDate} lowPointDate={lowPointDate} />
            </div>
            <div className="min-w-0 xl:flex-1">
              <EcheancesUpcomingList currentDate={currentDate} />
            </div>
          </div>
        </>
      ) : (
        <p role="status" className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          {t('no_account')}
        </p>
      )}
    </div>
  );
}
