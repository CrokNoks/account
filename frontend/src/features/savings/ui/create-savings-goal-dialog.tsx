'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button className="gap-2 px-4 shadow-lg shadow-primary/20" type="button" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>{t('add_goal')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Target className="w-5 h-5" />
              </div>
              <DialogTitle className="text-xl font-bold">{t('new_goal_title')}</DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
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

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" disabled={isPending || !name || !targetAmount}>
              {isPending ? tc('loading') : tc('add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
