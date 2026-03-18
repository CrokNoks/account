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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';

export function SavingsGoalsList() {
  const t = useTranslations('Savings');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { data: goals, isLoading } = useSavingsGoals(activeAccountId);
  const { mutate: deleteGoal } = useDeleteSavingsGoal();
  const { mutate: updateGoal } = useUpdateSavingsGoal();
  
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<SavingsGoal | null>(null);
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
        setContributingGoal(null);
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingGoal(goal)} title="Modifier l'objectif">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(goal.id)} title="Supprimer">
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
                    <Button size="sm" variant="outline" className="h-8 gap-2 font-bold" onClick={() => setContributingGoal(goal)}>
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

      <Sheet open={!!contributingGoal} onOpenChange={(o) => !o && setContributingGoal(null)}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0">
          <SheetHeader className="p-6 border-b">
            <SheetTitle>Contribuer à : {contributingGoal?.name}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Montant à ajouter</label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  className="h-12 text-lg font-bold pr-12"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">€</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Ce montant sera ajouté au solde actuel de l&apos;objectif.
              </p>
            </div>
          </div>
          <SheetFooter className="p-6 border-t bg-muted/20">
            <Button className="w-full h-11 text-base font-bold" onClick={() => contributingGoal && handleContribute(contributingGoal)} disabled={!contributionAmount}>
              Enregistrer la contribution
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {editingGoal && (
        <EditSavingsGoalSheet 
          goal={editingGoal} 
          open={!!editingGoal} 
          onOpenChange={(o) => !o && setEditingGoal(null)} 
        />
      )}
    </>
  );
}

function EditSavingsGoalSheet({ goal, open, onOpenChange }: { goal: SavingsGoal, open: boolean, onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('Savings');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const [name, setName] = useState(goal.name);
  const [targetAmount, setTargetAmount] = useState(fromCents(goal.targetAmount));
  const [currentAmount, setCurrentAmount] = useState(fromCents(goal.currentAmount));
  const [deadline, setDeadline] = useState(goal.deadline?.split('T')[0] || '');
  const [color, setColor] = useState(goal.color || '#3b82f6');

  const { mutate: updateGoal, isPending } = useUpdateSavingsGoal();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId || !name || !targetAmount) return;

    updateGoal({
      accountId: activeAccountId,
      id: goal.id,
      data: {
        name,
        targetAmount: toCents(targetAmount),
        currentAmount: toCents(currentAmount),
        deadline: deadline || null,
        color,
      }
    }, {
      onSuccess: () => {
        toast.success(tc('success'));
        onOpenChange(false);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>{tc('edit')} Objectif d&apos;épargne</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('fields.name')}</label>
              <Input 
                placeholder="Ex: Vacances d'été, Apport maison..." 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('fields.target_amount')}</label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="h-11 font-bold"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('fields.current_amount')}</label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('fields.deadline')}</label>
              <Input 
                type="date" 
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('fields.color')}</label>
              <div className="flex gap-2">
                <Input 
                  type="color" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-11 w-12 p-1 cursor-pointer"
                />
                <Input 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-11 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <SheetFooter className="p-6 border-t bg-muted/20">
            <Button type="submit" disabled={isPending || !name || !targetAmount} className="w-full h-11 text-base font-bold">
              {isPending ? tc('loading') : tc('save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
