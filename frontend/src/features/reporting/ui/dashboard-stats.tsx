'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/shared/lib/format";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { usePeriods } from "@/features/budgets/api/use-periods";
import { useReportingStats } from "../api/use-reporting-stats";
import { ArrowUpCircle, ArrowDownCircle, Wallet, History, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

export function DashboardStats() {
  const t = useTranslations('Reporting');
  const ta = useTranslations('Accounts');
  const { activeAccountId } = useAccountStore();
  const { data: periods, isLoading: isLoadingPeriods } = usePeriods(activeAccountId);
  
  const activePeriod = periods?.find(p => p.isActive);
  const { data: stats, isLoading: isLoadingStats } = useReportingStats(
    activeAccountId, 
    activePeriod?.id || null
  );

  if (isLoadingPeriods || isLoadingStats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!activeAccountId) return <p className="text-muted-foreground text-center">{ta('select_account')}</p>;
  if (!activePeriod) return <p className="text-muted-foreground text-center">{t('no_period')}</p>;
  if (!stats) return null;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Main Balances */}
        <StatCard 
          title={t('real_bank_balance')} 
          value={stats.realBankBalance} 
          icon={<Wallet className="w-4 h-4 text-muted-foreground" />}
          description={t('real_bank_balance')}
        />
        <StatCard 
          title={t('upcoming_balance')} 
          value={stats.upcomingBalance} 
          icon={<History className="w-4 h-4 text-muted-foreground" />}
          description={t('upcoming_balance')}
        />
        <StatCard 
          title={t('forecast_balance')} 
          value={stats.forecastBalance} 
          icon={<TrendingUp className="w-4 h-4 text-primary" />}
          description={t('forecast_balance')}
          highlight
        />
        <StatCard 
          title={t('start_balance')} 
          value={stats.startBalance} 
          icon={<Wallet className="w-4 h-4 text-muted-foreground" />}
          description={t('start_balance')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Income vs Expenses */}
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard 
            title={t('real_income')} 
            value={stats.realIncome} 
            icon={<ArrowUpCircle className="w-4 h-4 text-green-500" />}
            description={`${t('planned_income')}: ${formatCurrency(stats.plannedIncome)}`}
          />
          <StatCard 
            title={t('real_expenses')} 
            value={stats.realExpenses} 
            icon={<ArrowDownCircle className="w-4 h-4 text-red-500" />}
            description={`${t('planned_expenses')}: ${formatCurrency(stats.plannedExpenses)}`}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, description, highlight }: any) {
  const amount = parseInt(value, 10);
  const colorClass = amount < 0 ? "text-red-500" : "text-green-500";

  return (
    <Card className={highlight ? "border-primary/50 shadow-sm" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass}`}>
          {formatCurrency(value)}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
