import { DashboardStats } from "@/features/reporting/ui/dashboard-stats";
import { BudgetBreakdown } from "@/features/reporting/ui/budget-breakdown";
import { CreateTransactionDrawer } from "@/features/transactions/ui/create-transaction-drawer";

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
          <p className="text-muted-foreground">
            Track your bank balance, upcoming transactions and monthly forecasts.
          </p>
        </div>
        <CreateTransactionDrawer />
      </div>
      
      <DashboardStats />

      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Budget Breakdown</h2>
        <p className="text-muted-foreground">
          Analysis of real spending vs planned budget by category type.
        </p>
        <BudgetBreakdown />
      </div>
    </div>
  );
}


