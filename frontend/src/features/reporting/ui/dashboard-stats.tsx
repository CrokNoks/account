'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/shared/lib/format";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { usePeriods } from "@/features/budgets/api/use-periods";
import { useReportingStats } from "../api/use-reporting-stats";
import { ArrowUpCircle, ArrowDownCircle, Wallet, History, TrendingUp } from "lucide-react";

export function DashboardStats() {
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

  if (!activeAccountId) return <p className="text-muted-foreground text-center">Please select an account</p>;
  if (!activePeriod) return <p className="text-muted-foreground text-center">No active period found for this account</p>;
  if (!stats) return null;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Main Balances */}
        <StatCard 
          title="Bank Balance" 
          value={stats.realBankBalance} 
          icon={<Wallet className="w-4 h-4 text-muted-foreground" />}
          description="Reconciled balance"
        />
        <StatCard 
          title="Upcoming" 
          value={stats.upcomingBalance} 
          icon={<History className="w-4 h-4 text-muted-foreground" />}
          description="After all transactions"
        />
        <StatCard 
          title="Forecast" 
          value={stats.forecastBalance} 
          icon={<TrendingUp className="w-4 h-4 text-primary" />}
          description="Projected at period end"
          highlight
        />
        <StatCard 
          title="Start Balance" 
          value={stats.startBalance} 
          icon={<Wallet className="w-4 h-4 text-muted-foreground" />}
          description="At start of period"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Income vs Expenses */}
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard 
            title="Real Income" 
            value={stats.realIncome} 
            icon={<ArrowUpCircle className="w-4 h-4 text-green-500" />}
            description={`Planned: ${formatCurrency(stats.plannedIncome)}`}
          />
          <StatCard 
            title="Real Expenses" 
            value={stats.realExpenses} 
            icon={<ArrowDownCircle className="w-4 h-4 text-red-500" />}
            description={`Planned: ${formatCurrency(stats.plannedExpenses)}`}
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
