'use client';

import { useState } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCreateSavingsGoal } from '../api/use-savings-goals';
import { Plus, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toCents } from '@/shared/lib/format';

export function CreateSavingsGoalDialog() {
  const t = useTranslations('Savings');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const { mutate: createGoal, isPending } = useCreateSavingsGoal();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId || !name || !targetAmount) return;

    createGoal({
      accountId: activeAccountId,
      data: {
        name,
        targetAmount: toCents(targetAmount),
        deadline: deadline || undefined,
        color,
      }
    }, {
      onSuccess: () => {
        setOpen(false);
        setName('');
        setTargetAmount('');
        setDeadline('');
        setColor('#3b82f6');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button className="gap-2 px-4 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" />
            <span>{t('add_goal')}</span>
          </Button>
        }
      />
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Target className="w-5 h-5" />
            </div>
            <SheetTitle className="text-xl font-bold">{t('new_goal_title')}</SheetTitle>
          </div>
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('fields.deadline')}</label>
                <Input 
                  type="date" 
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="h-11"
                />
              </div>
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
              {isPending ? tc('loading') : tc('add')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
