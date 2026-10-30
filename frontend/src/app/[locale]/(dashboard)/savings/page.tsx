'use client';

import { SavingsGoalsList } from "@/features/savings/ui/savings-goals-list";
import { CreateSavingsGoalDialog } from "@/features/savings/ui/create-savings-goal-dialog";
import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function SavingsPage() {
  const t = useTranslations('Savings');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Target className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          </div>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <CreateSavingsGoalDialog />
      </div>

      <SavingsGoalsList />
    </div>
  );
}
