'use client';

import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/shared/lib/format";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useReportingStats } from "../api/use-reporting-stats";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const signClass = (value: string) => (parseInt(value, 10) < 0 ? "text-red-500" : "text-green-500");

/**
 * Barre des soldes de l'écran Aujourd'hui : le prévu de fin de période (chiffre principal, celui de
 * « stats », jamais recalculé ici), le solde en banque et le solde à venir.
 */
export function BalanceBar() {
  const t = useTranslations('Dashboard');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: stats, isLoading } = useReportingStats(activeAccountId, activePeriodId);

  if (isLoading || !stats) return <div data-tour="stats" className="h-32 bg-muted animate-pulse rounded-xl border-2" />;

  return (
    <div data-tour="stats">
      <Card className="border-2 shadow-sm overflow-hidden p-4 max-lg:p-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div data-testid="balance-forecast">
          <p className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('forecast_title')}
          </p>
          <p data-amount className={cn("text-3xl max-lg:text-3xl font-black tracking-tight", signClass(stats.forecastBalance))}>
            {formatCurrency(stats.forecastBalance)}
          </p>
        </div>
        <div className="flex gap-8 max-lg:justify-between">
          <div data-testid="balance-bank">
            <p className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('bank_title')}
            </p>
            <p className={cn("text-lg max-lg:text-xl font-black tracking-tight", signClass(stats.realBankBalance))}>
              {formatCurrency(stats.realBankBalance)}
            </p>
          </div>
          <div data-testid="balance-upcoming">
            <p className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('upcoming_title')}
            </p>
            <p className={cn("text-lg max-lg:text-xl font-black tracking-tight", signClass(stats.upcomingBalance))}>
              {formatCurrency(stats.upcomingBalance)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
