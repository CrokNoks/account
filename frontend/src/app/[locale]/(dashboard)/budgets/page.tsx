'use client';

import { BudgetsScreen } from '@/features/budgets/ui/budgets-screen';
import { ManagePeriods } from '@/features/budgets/ui/manage-periods';

export default function BudgetsPage() {
  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <BudgetsScreen />
      <ManagePeriods />
    </div>
  );
}
