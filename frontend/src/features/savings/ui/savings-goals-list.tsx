'use client';

import { useSavingsGoals, useDeleteSavingsGoal, useUpdateSavingsGoal, SavingsGoal } from '../api/use-savings-goals';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatCurrency, toCents, fromCents } from '@/shared/lib/format';
import { Trash2, Pencil, Calendar, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function SavingsGoalsList() {
  const t = useTranslations('Savings');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { data: goals, isLoading } = useSavingsGoals(activeAccountId);
  const { mutate: deleteGoal } = useDeleteSavingsGoal();
  const { mutate: updateGoal } = useUpdateSavingsGoal();
  
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
    {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted rounded-2xl" />)}
  </div>;

  const handleDelete = (id: string) => {
    if (!activeAccountId || !confirm(t('delete_confirm'))) return;
    deleteGoal({ accountId: activeAccountId, id }, {
      onSuccess: () => toast.success(t('deleted'))
    });
  };

  const handleContribute = (goal: SavingsGoal) => {
    if (!activeAccountId || !contributionAmount) return;
    
    const current = BigInt(goal.currentAmount);
    const added = BigInt(toCents(contributionAmount));
    
    updateGoal({
      accountId: activeAccountId,
      id: goal.id,
      data: { currentAmount: (current + added).toString() }
    }, {
      onSuccess: () => {
        toast.success('Contribution enregistrée');
        setEditingGoal(null);
        setContributionAmount('');
      }
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!goals || goals.length === 0 ? (
          <div className="col-span-full h-48 flex items-center justify-center text-muted-foreground bg-muted/10 rounded-2xl border-2 border-dashed">
            {t('empty')}
          </div>
        ) : (
          goals.map((goal) => {
            const target = parseInt(goal.targetAmount, 10);
            const current = parseInt(goal.currentAmount, 10);
            const percentage = Math.min(Math.round((current / target) * 100), 100);

            return (
              <Card key={goal.id} className="border-2 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                <CardHeader className="pb-4 bg-muted/10 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: goal.color }} />
                    <CardTitle className="text-lg font-bold">{goal.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingGoal(goal)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(goal.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 flex-1 flex flex-col justify-between gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-2xl font-black">{formatCurrency(goal.currentAmount)}</p>
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                          sur {formatCurrency(goal.targetAmount)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-primary">{percentage}%</span>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-3" style={{ color: goal.color }} />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {goal.deadline ? format(new Date(goal.deadline), 'dd MMM yyyy') : 'Pas d\'échéance'}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 gap-2 font-bold" onClick={() => setEditingGoal(goal)}>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Épargner
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!editingGoal} onOpenChange={(o) => !o && setEditingGoal(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Contribuer à : {editingGoal?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Montant à ajouter</label>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                className="h-12 text-lg font-bold"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGoal(null)}>{tc('cancel')}</Button>
            <Button onClick={() => editingGoal && handleContribute(editingGoal)} disabled={!contributionAmount}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
