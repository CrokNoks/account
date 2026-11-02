'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/shared/lib/format";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useReportingStats } from "../api/use-reporting-stats";
import { ArrowUpCircle, ArrowDownCircle, Wallet, History } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function ReportingStat({ type }: { type: 'bank' | 'upcoming' }) {
  const t = useTranslations('Reporting');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: stats, isLoading } = useReportingStats(activeAccountId, activePeriodId);

  if (isLoading || !stats) return <div className="h-32 bg-muted animate-pulse rounded-xl border-2" />;

  const config = {
    bank: {
      title: t('real_bank_balance'),
      value: stats.realBankBalance,
      icon: <Wallet className="w-4 h-4 text-muted-foreground" />,
      description: `${t('start_balance')} : ${formatCurrency(stats.startBalance)}`,
    },
    upcoming: {
      title: t('upcoming_balance'),
      value: stats.upcomingBalance,
      icon: <History className="w-4 h-4 text-muted-foreground" />,
      description: `${t('end_of_period_forecast')} : ${formatCurrency(stats.forecastBalance)}`,
      descriptionClass: parseInt(stats.forecastBalance, 10) < 0 ? 'text-red-500' : 'text-green-500',
    },
  }[type];

  return (
    <StatCard
      title={config.title}
      value={config.value}
      icon={config.icon}
      description={config.description}
      descriptionClass={'descriptionClass' in config ? config.descriptionClass : undefined}
    />
  );
}

// Revenus et dépenses réels de la période, chacun avec son prévu (budgets).
export function StatIncomeExpenses() {
  const t = useTranslations('Reporting');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: stats, isLoading } = useReportingStats(activeAccountId, activePeriodId);

  if (isLoading || !stats) return <div className="h-32 bg-muted animate-pulse rounded-xl border-2" />;

  const rows = [
    { icon: <ArrowUpCircle className="w-3 h-3 text-green-500" />, real: stats.realIncome, planned: stats.plannedIncome },
    { icon: <ArrowDownCircle className="w-3 h-3 text-red-500" />, real: stats.realExpenses, planned: stats.plannedExpenses },
  ];

  return (
    <Card className="border-2 shadow-sm h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-start gap-2 pb-3 space-y-0 bg-muted/10">
        <ArrowUpCircle className="w-4 h-4 text-muted-foreground" />
        <CardTitle className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('income_expenses')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 space-y-1">
        {rows.map((row, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2">
            <span className={cn("flex items-center gap-1 text-base max-lg:text-lg font-black tracking-tight", parseInt(row.real, 10) < 0 ? "text-red-500" : "text-green-500")}>
              {row.icon}
              {formatCurrency(row.real)}
            </span>
            <span className="text-[10px] max-lg:text-xs text-muted-foreground truncate">
              {t('planned')} : {formatCurrency(row.planned)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export const StatBankBalance = () => <ReportingStat type="bank" />;
export const StatUpcomingBalance = () => <ReportingStat type="upcoming" />;

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  descriptionClass?: string;
}

export function StatCard({ title, value, icon, description, descriptionClass }: StatCardProps) {
  const amount = parseInt(value, 10);
  const colorClass = amount < 0 ? "text-red-500" : "text-green-500";

  return (
    <Card className="border-2 shadow-sm h-full overflow-hidden max-lg:gap-2 max-lg:py-3">
      <CardHeader className="flex flex-row items-center justify-start gap-2 pb-3 max-lg:pb-1 space-y-0 bg-muted/10">
        {icon}
        <CardTitle className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 max-lg:pt-0">
        <div className={cn("text-xl max-lg:text-2xl font-black tracking-tight", colorClass)}>
          {formatCurrency(value)}
        </div>
        <p className={cn("text-[10px] max-lg:text-xs mt-1 truncate", descriptionClass ?? "text-muted-foreground")}>
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
