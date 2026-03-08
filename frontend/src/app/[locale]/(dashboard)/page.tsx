import { DashboardStats } from "@/features/reporting/ui/dashboard-stats";
import { BudgetBreakdown } from "@/features/reporting/ui/budget-breakdown";
import { CreateTransactionDrawer } from "@/features/transactions/ui/create-transaction-drawer";
import {useTranslations} from 'next-intl';

export default function Home() {
  const t = useTranslations('Dashboard');

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('welcome')}
          </p>
        </div>
        <CreateTransactionDrawer />
      </div>
      
      <DashboardStats />

      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight">{t('breakdown')}</h2>
        <BudgetBreakdown />
      </div>
    </div>
  );
}
