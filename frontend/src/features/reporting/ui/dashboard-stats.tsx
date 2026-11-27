'use client';

import { Card } from "@/components/ui/card";
import { usePresentAmount } from "../lib/signed-amount";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useReportingStats } from "../api/use-reporting-stats";
import { useLocale, useTranslations } from "next-intl";
import { usePeriods } from "@/features/budgets/api/use-periods";
import { formatShortDate, todayDateOnly } from "@/shared/lib/date-only";
import { periodEnd } from "@/features/periods/model/period-end";
import { periodProgress } from "../model/period-progress";
import { cn } from "@/lib/utils";
import { ForecastComposition } from "./forecast-composition";
import { PeriodSubtitle } from "./period-subtitle";

/**
 * Bloc hero de l'écran Aujourd'hui : le prévu de fin de période (chiffre principal, celui de
 * « stats », jamais recalculé ici), le solde en banque, le solde à venir et la composition du prévu.
 */
export function BalanceBar() {
  const present = usePresentAmount();
  const t = useTranslations('Dashboard');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const locale = useLocale();
  const { data: stats, isLoading } = useReportingStats(activeAccountId, activePeriodId);
  const { data: periods } = usePeriods(activeAccountId);
  const period = periods?.find((p) => p.id === activePeriodId);
  // Mobile : « Prévu le {fin} » et « Jour X sur Y » (masqués sans fin de période ou hors période).
  const end = period ? periodEnd(period) : null;
  const endDate = end ? formatShortDate(end, locale) : null;
  const progress = periodProgress(period?.startDate, end, todayDateOnly());

  if (isLoading || !stats) return <div data-tour="stats" className="h-32 bg-muted animate-pulse rounded-xl border-2" />;

  // Période clôturée : pas de projection, le chiffre principal est le solde en banque des stats.
  const closed = !!period && !period.isActive;
  const title = closed
    ? (endDate ? t('bank_balance_on', { date: endDate }) : t('bank_balance_title'))
    : (endDate ? t('forecast_on', { date: endDate }) : t('forecast_title'));
  const mainAmount = closed ? stats.realBankBalance : stats.forecastBalance;

  return (
    <div data-tour="stats">
      <Card className="border-2 shadow-sm overflow-hidden p-4 max-lg:p-3 max-lg:gap-3 flex flex-col gap-4">
        <PeriodSubtitle period={period} testId="period-subtitle-desktop" className="max-lg:hidden -mb-2 text-sm text-muted-foreground" />
        <div className="flex flex-col gap-4 max-lg:gap-1 lg:flex-row lg:items-end lg:justify-between">
        <div data-testid="balance-forecast">
          <p data-testid="forecast-title" className="max-lg:hidden text-sm font-medium text-muted-foreground">
            {title}
          </p>
          <p data-testid="forecast-title-mobile" className="lg:hidden text-sm font-medium text-muted-foreground">
            {title}
          </p>
          <p data-amount className={cn("text-3xl max-lg:text-3xl font-black tracking-tight", present(mainAmount, 'balance').className)}>
            {present(mainAmount, 'balance').text}
          </p>
          {progress && !closed && (
            <p data-testid="period-day" className="lg:hidden text-sm text-muted-foreground">
              {t('period_day', { day: progress.day, total: progress.total })}
            </p>
          )}
        </div>
        {/* Mobile : En banque est dans la composition du prévu, le solde à venir est en tête d'Opérations. */}
        {!closed && (
        <div className="max-lg:hidden flex gap-8">
          <div data-testid="balance-bank">
            <p className="text-sm font-medium text-muted-foreground">
              {t('bank_title')}
            </p>
            <p className={cn("text-lg font-black tracking-tight", present(stats.realBankBalance, 'balance').className)}>
              {present(stats.realBankBalance, 'balance').text}
            </p>
          </div>
          <div data-testid="balance-upcoming">
            <p className="text-sm font-medium text-muted-foreground">
              {t('upcoming_title')}
            </p>
            <p className={cn("text-lg font-black tracking-tight", present(stats.upcomingBalance, 'balance').className)}>
              {present(stats.upcomingBalance, 'balance').text}
            </p>
          </div>
        </div>
        )}
        </div>
        {!closed && <ForecastComposition />}
      </Card>
    </div>
  );
}
