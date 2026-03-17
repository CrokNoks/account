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
  const t = useTranslations('Reporting');
  const ta = useTranslations('Accounts');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: periods, isLoading: isLoadingPeriods } = usePeriods(activeAccountId);
  
  const selectedPeriod = periods?.find(p => p.id === activePeriodId);
  const { data: stats, isLoading: isLoadingStats } = useReportingStats(
    activeAccountId, 
    activePeriodId
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
  if (!activePeriodId) return <p className="text-muted-foreground text-center">{t('no_period')}</p>;
  if (!stats) return null;

  const isPeriodActive = selectedPeriod?.isActive;

  return (
    <div className="space-y-8" data-tour="stats">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard 
          title={t('start_balance')} 
          value={stats.startBalance} 
          icon={<Wallet className="w-4 h-4 text-muted-foreground" />}
          description={t('start_balance')}
        />
        
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

        <StatCard 
          title={t('real_bank_balance')} 
          value={stats.realBankBalance} 
          icon={<Wallet className="w-4 h-4 text-muted-foreground" />}
          description={t('real_bank_balance')}
        />

        {isPeriodActive && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  highlight?: boolean;
}

function StatCard({ title, value, icon, description, highlight }: StatCardProps) {
  const amount = parseInt(value, 10);
  const colorClass = amount < 0 ? "text-red-500" : "text-green-500";

  return (
    <Card className={cn("border-2 shadow-sm h-full", highlight && "border-primary/50 bg-primary/5")}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 bg-muted/10">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="pt-4">
        <div className={`text-xl font-black tracking-tight ${colorClass}`}>
          {formatCurrency(value)}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 truncate">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
