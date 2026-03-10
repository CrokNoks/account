'use client';

import { useState, useEffect } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter,
  SheetDescription
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { usePeriodBudgets } from '../api/use-period-budgets';
import { useUpdatePeriodBudgets } from '../api/use-update-period-budgets';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Calculator } from 'lucide-react';

interface EditPeriodBudgetsSheetProps {
  periodId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPeriodBudgetsSheet({ periodId, open, onOpenChange }: EditPeriodBudgetsSheetProps) {
  const t = useTranslations('Budgets');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  
  const { data: categories } = useCategories(activeAccountId);
  const { data: existingBudgets, isLoading: isLoadingBudgets } = usePeriodBudgets(activeAccountId, periodId);
  const { mutate: updateBudgets, isPending } = useUpdatePeriodBudgets();

  const [budgets, setBudgets] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existingBudgets && open) {
      const initialBudgets: Record<string, string> = {};
      existingBudgets.forEach(b => {
        initialBudgets[b.categoryId] = (parseInt(b.amountAllocated, 10) / 100).toString();
      });
      setBudgets(initialBudgets);
    }
  }, [existingBudgets, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    updateBudgets({
      accountId: activeAccountId,
      periodId,
      data: {
        budgets: Object.entries(budgets)
          .filter(([_, amount]) => amount !== '' && !isNaN(parseFloat(amount)))
          .map(([categoryId, amount]) => ({
            categoryId,
            amountAllocated: Math.round(parseFloat(amount) * 100).toString(),
          })),
      }
    }, {
      onSuccess: () => {
        toast.success(t('updated'));
        onOpenChange(false);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>Modifier les budgets</SheetTitle>
          <SheetDescription>
            Ajustez les montants alloués pour chaque catégorie pour cette période.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="edit-budgets-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                {t('fields.budget_init')}
              </h3>
              <div className="border rounded-lg divide-y">
                {isLoadingBudgets ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {tc('loading')}
                  </div>
                ) : categories && categories.length > 0 ? (
                  categories.map((cat) => (
                    <div key={cat.id} className="p-4 flex items-center justify-between gap-4 group hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full shrink-0" 
                            style={{ backgroundColor: cat.color }} 
                          />
                          <p className="text-sm font-medium truncate">{cat.name}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                          {cat.type}
                        </p>
                      </div>
                      <div className="w-32">
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          value={budgets[cat.id] || ''}
                          onChange={(e) => setBudgets({ ...budgets, [cat.id]: e.target.value })}
                          className="text-right"
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
          </form>
        </div>

        <SheetFooter className="p-6 border-t bg-muted/20">
          <Button 
            type="submit" 
            form="edit-budgets-form" 
            className="w-full h-11 text-base font-semibold"
            disabled={isPending || isLoadingBudgets}
          >
            {isPending ? tc('loading') : tc('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
