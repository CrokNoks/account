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
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useCreateTransaction } from '../api/use-create-transaction';
import { usePredictCategory } from '../api/use-predict-category';
import { Plus, Receipt, Check, ChevronsUpDown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export function CreateTransactionDrawer() {
  const t = useTranslations('Transactions');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { data: categories } = useCategories(activeAccountId);
  const { data: periods } = usePeriods(activeAccountId);
  const { mutate: createTransaction, isPending } = useCreateTransaction();

  const [open, setOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [debouncedDescription, setDebouncedDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [amount, setAmount] = useState('');

  const activePeriod = periods?.find(p => p.isActive);

  // Debounce description for prediction
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDescription(description);
    }, 600);
    return () => clearTimeout(timer);
  }, [description]);

  // Prediction Query
  const { data: prediction } = usePredictCategory(activeAccountId, debouncedDescription);

  // Auto-apply prediction if user hasn't manually selected a category yet
  useEffect(() => {
    if (prediction?.categoryId && !categoryId && description.length >= 3) {
      setCategoryId(prediction.categoryId);
      toast.info(t('new_transaction_title'), {
        description: "Catégorie suggérée automatiquement",
        icon: <Sparkles className="w-4 h-4 text-yellow-500" />
      });
    }
  }, [prediction, categoryId, description.length, t]);

  // Reset form when sheet closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategoryId('');
  };

  const handleSubmit = (addAnother = false) => {
    if (!activeAccountId || !description || !amount) return;

    createTransaction({
      accountId: activeAccountId,
      date,
      description,
      categoryId: categoryId || null,
      amount: (parseFloat(amount) * 100).toString(),
      periodId: activePeriod?.id,
    }, {
      onSuccess: () => {
        toast.success(`Transaction "${description}" added`);
        resetForm();
        if (!addAnother) {
          setOpen(false);
        }
      }
    });
  };

  const selectedCategory = categories?.find((c) => c.id === categoryId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger 
        render={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t('add_transaction')}
          </Button>
        }
      />
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <SheetTitle>{t('new_transaction_title')}</SheetTitle>
          </div>
          <SheetDescription>
            {t('new_transaction_desc')}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.date')}</label>
            <Input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.description')}</label>
            <Input 
              placeholder="Rent, Groceries, Salary..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2 flex flex-col">
            <label className="text-sm font-medium">{t('fields.category')}</label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger 
                render={
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full h-11 justify-between font-normal"
                  >
                    {categoryId ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedCategory?.color }} />
                        {selectedCategory?.name}
                      </div>
                    ) : (
                      "Sélectionner une catégorie..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                }
              />
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Rechercher une catégorie..." />
                  <CommandList>
                    <CommandEmpty>Aucune catégorie trouvée.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          setCategoryId("");
                          setComboOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            categoryId === "" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Sans catégorie
                      </CommandItem>
                      {categories?.map((cat) => (
                        <CommandItem
                          key={cat.id}
                          value={cat.name}
                          onSelect={() => {
                            setCategoryId(cat.id);
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              categoryId === cat.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.name}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
            <p className="text-[10px] text-muted-foreground italic">{t('expense_hint')}</p>
          </div>
        </div>

        <SheetFooter className="p-6 border-t bg-muted/20 flex-col gap-3 sm:flex-col">
          <Button 
            className="w-full h-11 text-base font-semibold" 
            onClick={() => handleSubmit(false)} 
            disabled={isPending}
          >
            {isPending ? tc('loading') : tc('save')}
          </Button>
          <Button 
            variant="outline" 
            className="w-full h-11 text-base" 
            onClick={() => handleSubmit(true)}
            disabled={isPending}
          >
            {isPending ? tc('loading') : t('save_another')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
