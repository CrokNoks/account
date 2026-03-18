'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from "@/components/ui/checkbox";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriodDraft } from '../api/use-period-draft';
import { useCreatePeriod } from '../api/use-create-period';
import { Plus, Calculator } from 'lucide-react';
import { formatCurrency, toCents, fromCents } from '@/shared/lib/format';
import { useTranslations } from 'next-intl';

export function CreatePeriodDialog() {
  const { activeAccountId } = useAccountStore();
  const t = useTranslations('Budgets');
  const tc = useTranslations('Common');
  
  const [open, setOpen] = useState(false);
  
  const { data: draft, isLoading: isLoadingDraft, refetch } = usePeriodDraft(activeAccountId);
  const { mutate: createPeriod, isPending } = useCreatePeriod();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgets, setBudgets] = useState<Record<string, string>>({});
  const [injectRecurring, setInjectRecurring] = useState(true);

  // Sync internal state when draft changes OR when dialog opens
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

   
  useEffect(() => {
    if (draft && open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStartDate(draft.suggestedStartDate.split('T')[0]);
      setEndDate(draft.suggestedEndDate.split('T')[0]);
      
      const initialBudgets: Record<string, string> = {};
      draft.categoriesWithStats.forEach(cat => {
        initialBudgets[cat.categoryId] = fromCents(cat.defaultAllocated);
      });
      setBudgets(initialBudgets);
    }
  }, [draft, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    createPeriod({
      accountId: activeAccountId,
      startDate,
      endDate,
      budgets: Object.entries(budgets).map(([categoryId, amount]) => ({
        categoryId,
        amountAllocated: toCents(amount),
      })),
      injectRecurring,
    }, {
      onSuccess: () => setOpen(false)
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger 
        render={
          <Button className="gap-2" variant="outline">
            <Plus className="w-4 h-4" />
            {t('new_period')}
          </Button>
        }
      />
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-xl">
        <div key={draft?.suggestedStartDate || 'new-period-content'} className="flex flex-col h-full">
          <SheetHeader className="p-6 border-b">
            <SheetTitle>{t('new_period_title')}</SheetTitle>
            <SheetDescription>
              {t('new_period_desc')}
            </SheetDescription>
          </SheetHeader>
          
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('fields.start_date')}</label>
                  <Input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('fields.end_date')}</label>
                  <Input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-primary/5 p-4 rounded-xl border border-primary/10">
                <Checkbox 
                  id="inject-recurring" 
                  checked={injectRecurring} 
                  onCheckedChange={(checked) => setInjectRecurring(!!checked)} 
                />
                <label 
                  htmlFor="inject-recurring" 
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  {t('inject_label')}
                </label>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  {t('fields.budget_init')}
                </h3>
                <div className="border rounded-xl divide-y overflow-hidden bg-background shadow-sm">
                  {isLoadingDraft ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      {tc('loading')}
                    </div>
                  ) : draft?.categoriesWithStats && draft.categoriesWithStats.length > 0 ? (
                    draft.categoriesWithStats.map((cat) => (
                      <div key={cat.categoryId} className="p-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{cat.name}</p>
                          <div className="flex gap-2 text-[10px] text-muted-foreground mt-1">
                            <span>{t('stats_hint', { 
                              min: formatCurrency(cat.minReal), 
                              avg: formatCurrency(cat.avgReal), 
                              max: formatCurrency(cat.maxReal) 
                            })}</span>
                          </div>
                        </div>
                        <div className="w-32">
                          <Input 
                            type="number" 
                            step="0.01"
                            value={budgets[cat.categoryId] || '0'}
                            onChange={(e) => setBudgets({ ...budgets, [cat.categoryId]: e.target.value })}
                            className="text-right h-10 font-bold"
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Aucune catégorie disponible.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <SheetFooter className="p-6 border-t bg-muted/20">
              <Button type="submit" disabled={isPending || isLoadingDraft} className="w-full h-11 text-base font-semibold">
                {isPending ? tc('loading') : tc('add')}
              </Button>
            </SheetFooter>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
