'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useAccounts } from '@/features/accounts/api/use-accounts';
import { useCreateTransaction } from '../api/use-create-transaction';
import { useCreateTransfer } from '../api/use-create-transfer';
import { usePredictCategory } from '../api/use-predict-category';
import { useUiStore } from '@/shared/model/use-ui-store';
import { Plus, Receipt, Check, ChevronsUpDown, Sparkles, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export function CreateTransactionDrawer() {
  const t = useTranslations('Transactions');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { isCreateTransactionDrawerOpen, setCreateTransactionDrawerOpen } = useUiStore();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories(activeAccountId);
  const { data: periods } = usePeriods(activeAccountId);
  const { mutate: createTransaction, isPending: isCreatingTransaction } = useCreateTransaction();
  const { mutate: createTransfer, isPending: isCreatingTransfer } = useCreateTransfer();

  const isPending = isCreatingTransaction || isCreatingTransfer;

  const [mode, setMode] = useState<'standard' | 'transfer'>('standard');
  const [comboOpen, setComboOpen] = useState(false);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [debouncedDescription, setDebouncedDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');

  const dateInputRef = useRef<HTMLInputElement>(null);

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
    if (mode === 'standard' && prediction?.categoryId && !categoryId && description.length >= 3) {
      setCategoryId(prediction.categoryId);
      toast.info(t('new_transaction_title'), {
        description: "Catégorie suggérée automatiquement",
        icon: <Sparkles className="w-4 h-4 text-yellow-500" />
      });
    }
  }, [prediction, categoryId, description.length, t, mode]);

  // Reset form when sheet closes
  useEffect(() => {
    if (!isCreateTransactionDrawerOpen) {
      resetForm();
    } else {
      // Focus date input when opening
      setTimeout(() => {
        dateInputRef.current?.focus();
      }, 100);
    }
  }, [isCreateTransactionDrawerOpen]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategoryId('');
    setDestinationAccountId('');
    setMode('standard');
  };

  const handleSubmit = (addAnother = false) => {
    if (!activeAccountId || !description || !amount) return;

    if (mode === 'transfer') {
      if (!destinationAccountId) return;
      createTransfer({
        sourceAccountId: activeAccountId,
        destinationAccountId,
        amount: Math.round(Math.abs(parseFloat(amount)) * 100).toString(),
        date,
        description,
      }, {
        onSuccess: () => {
          toast.success(`Transfer "${description}" created`);
          resetForm();
          if (!addAnother) setCreateTransactionDrawerOpen(false);
        }
      });
    } else {
      createTransaction({
        accountId: activeAccountId,
        date,
        description,
        categoryId: categoryId || null,
        amount: Math.round(parseFloat(amount) * 100).toString(),
        periodId: activePeriod?.id,
      }, {
        onSuccess: () => {
          toast.success(`Transaction "${description}" added`);
          resetForm();
          if (!addAnother) setCreateTransactionDrawerOpen(false);
        }
      });
    }
  };

  const selectedCategory = categories?.find((c) => c.id === categoryId);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !comboOpen) {
      e.preventDefault();
      handleSubmit(!e.shiftKey);
    }
  };

  const availableDestinations = accounts?.filter(a => a.id !== activeAccountId) || [];

  return (
    <Sheet open={isCreateTransactionDrawerOpen} onOpenChange={setCreateTransactionDrawerOpen}>
      <SheetTrigger 
        render={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t('add_transaction')}
          </Button>
        }
      />
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col gap-0 p-0" onKeyDown={handleKeyDown}>
        <SheetHeader className="p-6 border-b">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="standard" className="gap-2">
                <Receipt className="w-4 h-4" /> Standard
              </TabsTrigger>
              <TabsTrigger value="transfer" className="gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Transfert
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.date')}</label>
            <Input 
              ref={dateInputRef}
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
              placeholder={mode === 'transfer' ? "Virement épargne, Loyer partagé..." : "Rent, Groceries, Salary..."} 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="h-11"
            />
          </div>

          {mode === 'standard' && (
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
          )}

          {mode === 'transfer' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Compte de destination</label>
              <Select value={destinationAccountId} onValueChange={(v) => setDestinationAccountId(v || '')}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Sélectionner le compte de destination..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDestinations.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">Aucun autre compte disponible</div>
                  ) : (
                    availableDestinations.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

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
            {mode === 'standard' && (
              <p className="text-[10px] text-muted-foreground italic">{t('expense_hint')}</p>
            )}
            {mode === 'transfer' && (
              <p className="text-[10px] text-muted-foreground italic">Le montant sera déduit du compte actuel et ajouté au compte de destination.</p>
            )}
          </div>
        </div>

        <SheetFooter className="p-6 border-t bg-muted/20 flex-col gap-3 sm:flex-col">
          <Button 
            variant="outline"
            className="w-full h-11 text-base flex justify-between px-4" 
            onClick={() => handleSubmit(true)}
            disabled={isPending || (mode === 'transfer' && !destinationAccountId)}
          >
            <span>{isPending ? tc('loading') : t('save_another')}</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              Enter
            </kbd>
          </Button>
          <Button 
            className="w-full h-11 text-base font-semibold flex justify-between px-4" 
            onClick={() => handleSubmit(false)} 
            disabled={isPending || (mode === 'transfer' && !destinationAccountId)}
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
