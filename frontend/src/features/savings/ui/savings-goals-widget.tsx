'use client';

import { useSavingsGoals } from '../api/use-savings-goals';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/shared/lib/format';
import { Target, TrendingUp } from 'lucide-react';

export function SavingsGoalsWidget() {
  const { activeAccountId } = useAccountStore();
  const { data: goals, isLoading } = useSavingsGoals(activeAccountId);

  if (isLoading) return <div className="h-48 bg-muted animate-pulse rounded-xl" />;
  if (!goals || goals.length === 0) return null;

  return (
    <Card className="border-2 shadow-sm overflow-hidden h-full">
      <CardHeader className="pb-3 bg-muted/10">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Objectifs d&apos;épargne
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {goals.map((goal) => {
          const target = parseInt(goal.targetAmount, 10);
          const current = parseInt(goal.currentAmount, 10);
          const percentage = Math.min(Math.round((current / target) * 100), 100);

          return (
            <div key={goal.id} className="space-y-2">
              <div className="flex justify-between items-end">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold leading-none">{goal.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">
                    {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                  </p>
                </div>
                <span className="text-xs font-black text-primary">{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-2" style={{ color: goal.color }} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
