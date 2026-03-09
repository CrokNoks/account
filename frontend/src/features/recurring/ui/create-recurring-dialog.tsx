'use client';

import { useState } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { useCreateRecurringTransaction } from '../api/use-create-recurring-transaction';
import { Plus, Repeat } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function CreateRecurringDialog() {
  const t = useTranslations('Recurring');
  const tc = useTranslations('Common');
  const tt = useTranslations('Transactions');
  const { activeAccountId } = useAccountStore();
  const { data: categories } = useCategories(activeAccountId);
  const { mutate: createRecurring, isPending } = useCreateRecurringTransaction();

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategoryId('');
    setDayOfMonth('1');
  };

  const handleSubmit = (addAnother = false) => {
    if (!activeAccountId || !description || !amount) return;

    createRecurring({
      accountId: activeAccountId,
      description,
      categoryId: categoryId || null,
      amount: Math.round(parseFloat(amount) * 100).toString(),
      dayOfMonth: parseInt(dayOfMonth, 10),
    }, {
      onSuccess: () => {
        resetForm();
        if (!addAnother) {
          setOpen(false);
        }
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(!e.shiftKey);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger 
        render={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t('add_recurring')}
          </Button>
        }
      />
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col gap-0 p-0" onKeyDown={handleKeyDown}>
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" />
            <SheetTitle>{t('new_recurring_title')}</SheetTitle>
          </div>
          <SheetDescription>
            {t('new_recurring_desc')}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.description')}</label>
            <Input 
              placeholder="Netflix, Rent, Salary..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fields.category')}</label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v || '')}>
                <SelectTrigger className="h-11">
                  <SelectValue>
                    {categoryId ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categories?.find(c => c.id === categoryId)?.color }} />
                        {categories?.find(c => c.id === categoryId)?.name}
                      </div>
                    ) : "Select category"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fields.day_of_month')}</label>
              <Input 
                type="number" 
                min="1" 
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                required
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.amount')}</label>
            <div className="relative">
              <Input 
                type="number" 
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-12 h-11 text-lg font-semibold"
                required
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">€</span>
            </div>
          </div>
        </div>

        <SheetFooter className="p-6 border-t bg-muted/20 flex-col gap-3 sm:flex-col">
          <Button 
            variant="outline"
            className="w-full h-11 text-base flex justify-between px-4" 
            onClick={() => handleSubmit(true)}
            disabled={isPending}
          >
            <span>{isPending ? tc('loading') : tt('save_another')}</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              Enter
            </kbd>
          </Button>
          <Button 
            className="w-full h-11 text-base font-semibold flex justify-between px-4" 
            onClick={() => handleSubmit(false)} 
            disabled={isPending}
          >
            <span>{isPending ? tc('loading') : tc('save')}</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-primary-foreground/20 px-1.5 font-mono text-[10px] font-medium text-primary-foreground opacity-100">
              <span className="text-xs">⇧</span> Enter
            </kbd>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
