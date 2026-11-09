'use client';

import { Card } from "@/components/ui/card";
import { usePresentAmount } from "../lib/signed-amount";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useReportingStats } from "../api/use-reporting-stats";
import { useLocale, useTranslations } from "next-intl";
import { usePeriods } from "@/features/budgets/api/use-periods";
import { formatShortDate, todayDateOnly } from "@/shared/lib/date-only";
import { periodProgress } from "../model/period-progress";
import { cn } from "@/lib/utils";
import { ForecastComposition } from "./forecast-composition";

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
  const endDate = period?.endDate ? formatShortDate(period.endDate, locale) : null;
  const progress = periodProgress(period?.startDate, period?.endDate, todayDateOnly());

  if (isLoading || !stats) return <div data-tour="stats" className="h-32 bg-muted animate-pulse rounded-xl border-2" />;

  return (
    <div data-tour="stats">
      <Card className="border-2 shadow-sm overflow-hidden p-4 max-lg:p-3 max-lg:gap-3 flex flex-col gap-4">
        <div className="flex flex-col gap-4 max-lg:gap-1 lg:flex-row lg:items-end lg:justify-between">
        <div data-testid="balance-forecast">
          <p className="max-lg:hidden text-sm font-medium text-muted-foreground">
            {t('forecast_title')}
          </p>
          <p data-testid="forecast-title-mobile" className="lg:hidden text-sm font-medium text-muted-foreground">
            {endDate ? t('forecast_on', { date: endDate }) : t('forecast_title')}
          </p>
          <p data-amount className={cn("text-3xl max-lg:text-3xl font-black tracking-tight", present(stats.forecastBalance, 'balance').className)}>
            {present(stats.forecastBalance, 'balance').text}
          </p>
          {progress && (
            <p data-testid="period-day" className="lg:hidden text-sm text-muted-foreground">
              {t('period_day', { day: progress.day, total: progress.total })}
            </p>
          )}
        </div>
        {/* Mobile : En banque est dans la composition du prévu, le solde à venir est en tête d'Opérations. */}
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
        </div>
        <ForecastComposition />
      </Card>
    </div>
  );
}
