'use client';

import { useState, useRef, SetStateAction } from 'react';
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useAccounts } from '@/features/accounts/api/use-accounts';
import { useCreateTransaction } from '../api/use-create-transaction';
import { useCreateTransfer } from '../api/use-create-transfer';
import { usePredictCategory } from '../api/use-predict-category';
import { useScanReceipt } from '@/features/reporting/api/use-scan-receipt';
import { useUiStore } from '@/shared/model/use-ui-store';
import { TagSelector } from '@/features/tags/ui/tag-selector';
import { Plus, Receipt, Check, ChevronsUpDown, Sparkles, ArrowRightLeft, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { toCents, toAbsCents } from '@/shared/lib/format';

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
  const { mutate: scanReceipt, isPending: isScanning } = useScanReceipt();
  const { mutate: predictCategory } = usePredictCategory();

  const isPending = isCreatingTransaction || isCreatingTransfer || isScanning;

  const [mode, setMode] = useState<'standard' | 'transfer'>('standard');
  const [comboOpen, setComboOpen] = useState(false);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');

  const dateInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const predictionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activePeriod = periods?.find(p => p.isActive);

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAccountId) return;

    // Use a canvas to resize/compress the image
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Get compressed base64
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        
        scanReceipt({ 
          accountId: activeAccountId, 
          base64Image: compressedBase64, 
          mimeType: 'image/jpeg' 
        }, {
          onSuccess: (data) => {
            if (data.date) setDate(data.date);
            if (data.amount) setAmount(data.amount.toString());
            if (data.description) setDescription(data.description);
            toast.success("Ticket analysé avec succès !");
          },
          onError: () => {
            toast.error("Erreur lors de l'analyse du ticket.");
          }
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);

    if (predictionTimeoutRef.current) {
      clearTimeout(predictionTimeoutRef.current);
    }

    if (mode === 'standard' && activeAccountId && value.length >= 3 && !categoryId) {
      predictionTimeoutRef.current = setTimeout(() => {
        predictCategory({ accountId: activeAccountId, description: value }, {
          onSuccess: (data) => {
            if (data.categoryId) {
              setCategoryId(data.categoryId);
              toast.info(t('new_transaction_title'), {
                description: "Catégorie suggérée automatiquement",
                icon: <Sparkles className="w-4 h-4 text-yellow-500" />
              });
            }
          }
        });
      }, 600);
    }
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setPending(false);
    setCategoryId('');
    setTagIds([]);
    setDestinationAccountId('');
    setMode('standard');
  };

  const handleOpenChange = (open: boolean) => {
    setCreateTransactionDrawerOpen(open);
    if (!open) {
      resetForm();
    } else {
      setTimeout(() => {
        dateInputRef.current?.focus();
      }, 100);
    }
  };

  const handleSubmit = (addAnother = false) => {
    if (!activeAccountId || !description || !amount) return;

    if (mode === 'transfer') {
      if (!destinationAccountId) return;
      createTransfer({
        sourceAccountId: activeAccountId,
        destinationAccountId,
        amount: toAbsCents(amount),
        date,
        description,
      }, {
        onSuccess: () => {
          toast.success(`Transfer "${description}" created`);
          resetForm();
          if (!addAnother) setCreateTransactionDrawerOpen(false);
          else {
            setTimeout(() => dateInputRef.current?.focus(), 0);
          }
        }
      });
    } else {
      createTransaction({
        accountId: activeAccountId,
        date,
        description,
        categoryId: categoryId || null,
        amount: toCents(amount),
        periodId: activePeriod?.id,
        pending,
        tagIds,
      }, {
        onSuccess: () => {
          toast.success(`Transaction "${description}" added`);
          resetForm();
          if (!addAnother) setCreateTransactionDrawerOpen(false);
          else {
            setTimeout(() => dateInputRef.current?.focus(), 0);
          }
        }
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !comboOpen) {
      e.preventDefault();
      handleSubmit(!e.shiftKey);
    }

    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      setMode(prev => prev === 'standard' ? 'transfer' : 'standard');
    }
  };

  const selectedCategory = categories?.find((c) => c.id === categoryId);
  const availableDestinations = accounts?.filter(a => a.id !== activeAccountId) || [];
  const isFormValid = activeAccountId && description && amount && (mode === 'standard' || (mode === 'transfer' && destinationAccountId));

  return (
    <Sheet open={isCreateTransactionDrawerOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0" onKeyDown={handleKeyDown}>
        <SheetHeader className="p-6 border-b space-y-4">
          <div className="flex items-center justify-between">
            <SheetTitle>{mode === 'standard' ? t('new_transaction_title') : 'Nouveau transfert'}</SheetTitle>
            
            {/* Scan Receipt Button - Mobile only */}
            <div className="lg:hidden">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleScanReceipt}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-2 border-primary/30 text-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
              >
                {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                <span>Scanner</span>
              </Button>
            </div>

            <div className="hidden lg:flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded border">
              <span className="opacity-70 mr-0.5 text-[9px] uppercase tracking-wider">Mode:</span>
              <kbd className="font-mono">⇧</kbd>
              <span>+</span>
              <kbd className="font-mono">Tab</kbd>
            </div>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as SetStateAction<'standard' | 'transfer'>)} className="w-full">
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
              onChange={(e) => handleDescriptionChange(e.target.value)}
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

          {mode === 'standard' && (
            <div className="space-y-2 flex flex-col">
              <label className="text-sm font-medium">Tags</label>
              {activeAccountId && (
                <TagSelector 
                  accountId={activeAccountId} 
                  selectedTagIds={tagIds} 
                  onChange={setTagIds} 
                />
              )}
            </div>
          )}

          {mode === 'transfer' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Compte de destination</label>
              <Select value={destinationAccountId} onValueChange={(v) => setDestinationAccountId(v || '')}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Sélectionner le compte de destination...">
                    {destinationAccountId ? availableDestinations.find(a => a.id === destinationAccountId)?.name : "Sélectionner le compte de destination..."}
                  </SelectValue>
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

          {mode === 'standard' && (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
              <Checkbox 
                id="pending-field" 
                checked={pending} 
                onCheckedChange={(checked) => setPending(!!checked)} 
              />
              <label htmlFor="pending-field" className="text-sm font-medium cursor-pointer select-none flex-1">
                {t('fields.pending')}
              </label>
              <p className="text-[10px] text-muted-foreground">Exclu du solde à venir</p>
            </div>
          )}
        </div>

        <SheetFooter className="p-6 border-t bg-muted/20 flex-col gap-3 sm:flex-col">
          <Button 
            variant="outline"
            className="w-full h-11 text-base flex justify-between px-4" 
            onClick={() => handleSubmit(true)}
            disabled={isPending || !isFormValid}
          >
            <span>{isPending ? tc('loading') : t('save_another')}</span>
            <kbd className="hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              Enter
            </kbd>
          </Button>
          <Button 
            className="w-full h-11 text-base font-semibold flex justify-between px-4" 
            onClick={() => handleSubmit(false)} 
            disabled={isPending || !isFormValid}
          >
            <span>{isPending ? tc('loading') : tc('save')}</span>
            <kbd className="hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-primary-foreground/20 px-1.5 font-mono text-[10px] font-medium text-primary-foreground opacity-100">
              <span className="text-xs">⇧</span> Enter
            </kbd>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
