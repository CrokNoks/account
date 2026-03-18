'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/shared/lib/format";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { usePeriods } from "@/features/budgets/api/use-periods";
import { useReportingStats } from "../api/use-reporting-stats";
import { ArrowUpCircle, ArrowDownCircle, Wallet, History, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function DashboardStats() {
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  const selectedPeriod = periods?.find(p => p.id === activePeriodId);
  const isPeriodActive = selectedPeriod?.isActive;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" data-tour="stats">
      <ReportingStat type="start" />
      <ReportingStat type="income" />
      <ReportingStat type="expenses" />
      <ReportingStat type="bank" />
      {isPeriodActive && (
        <>
          <ReportingStat type="upcoming" />
          <ReportingStat type="forecast" />
        </>
      )}
    </div>
  );
}

export function ReportingStat({ type }: { type: 'start' | 'income' | 'expenses' | 'bank' | 'upcoming' | 'forecast' }) {
  const t = useTranslations('Reporting');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: stats, isLoading } = useReportingStats(activeAccountId, activePeriodId);

  if (isLoading || !stats) return <div className="h-32 bg-muted animate-pulse rounded-xl border-2" />;

  const config = {
    start: {
      title: t('start_balance'),
      value: stats.startBalance,
      icon: <Wallet className="w-4 h-4 text-muted-foreground" />,
      description: t('start_balance'),
      highlight: false,
    },
    income: {
      title: t('real_income'),
      value: stats.realIncome,
      icon: <ArrowUpCircle className="w-4 h-4 text-green-500" />,
      description: `${t('planned_income')}: ${formatCurrency(stats.plannedIncome)}`,
      highlight: false,
    },
    expenses: {
      title: t('real_expenses'),
      value: stats.realExpenses,
      icon: <ArrowDownCircle className="w-4 h-4 text-red-500" />,
      description: `${t('planned_expenses')}: ${formatCurrency(stats.plannedExpenses)}`,
      highlight: false,
    },
    bank: {
      title: t('real_bank_balance'),
      value: stats.realBankBalance,
      icon: <Wallet className="w-4 h-4 text-muted-foreground" />,
      description: t('real_bank_balance'),
      highlight: false,
    },
    upcoming: {
      title: t('upcoming_balance'),
      value: stats.upcomingBalance,
      icon: <History className="w-4 h-4 text-muted-foreground" />,
      description: t('upcoming_balance'),
      highlight: false,
    },
    forecast: {
      title: t('forecast_balance'),
      value: stats.forecastBalance,
      icon: <TrendingUp className="w-4 h-4 text-primary" />,
      description: t('forecast_balance'),
      highlight: true,
    },
  }[type];

  return (
    <StatCard 
      title={config.title} 
      value={config.value} 
      icon={config.icon}
      description={config.description}
      highlight={config.highlight}
    />
  );
}

// Kept for backward compatibility with Dashboard layout
export const StatStartBalance = () => <ReportingStat type="start" />;
export const StatRealIncome = () => <ReportingStat type="income" />;
export const StatRealExpenses = () => <ReportingStat type="expenses" />;
export const StatBankBalance = () => <ReportingStat type="bank" />;
export const StatUpcomingBalance = () => <ReportingStat type="upcoming" />;
export const StatForecastBalance = () => <ReportingStat type="forecast" />;

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  highlight?: boolean;
}

export function StatCard({ title, value, icon, description, highlight }: StatCardProps) {
  const amount = parseInt(value, 10);
  const colorClass = amount < 0 ? "text-red-500" : "text-green-500";

  return (
    <Card className="border-2 shadow-sm h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-start gap-2 pb-3 space-y-0 bg-muted/10">
        {icon}
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className={cn(
          "text-xl font-black tracking-tight",
          highlight ? "text-primary underline decoration-primary/30 underline-offset-4" : colorClass
        )}>
          {formatCurrency(value)}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 truncate">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
