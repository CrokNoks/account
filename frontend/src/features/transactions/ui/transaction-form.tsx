'use client';

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TagSelector } from '@/features/tags/ui/tag-selector';
import { CategorySelector } from '@/features/categories/ui/category-selector';
import { useTranslations } from 'next-intl';
import { useAccounts } from '@/features/accounts/api/use-accounts';
import { usePredictCategory } from '../api/use-predict-category';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export interface TransactionFormValues {
  date: string;
  description: string;
  categoryId: string;
  tagIds: string[];
  amount: string;
  pending: boolean;
  destinationAccountId?: string;
}

interface TransactionFormProps {
  accountId: string | null;
  initialValues?: Partial<TransactionFormValues>;
  onSubmit: (values: TransactionFormValues) => void;
  isPending: boolean;
  submitLabel: string;
  mode?: 'standard' | 'transfer';
  onAddAnother?: (values: TransactionFormValues) => void;
}

export function TransactionForm({
  accountId,
  initialValues,
  onSubmit,
  isPending,
  submitLabel,
  mode = 'standard',
  onAddAnother,
}: TransactionFormProps) {
  const t = useTranslations('Transactions');
  const tc = useTranslations('Common');
  const { data: accounts } = useAccounts();
  const { mutate: predictCategory } = usePredictCategory();

  const [date, setDate] = useState(initialValues?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(initialValues?.description || '');
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId || '');
  const [tagIds, setTagIds] = useState<string[]>(initialValues?.tagIds || []);
  const [amount, setAmount] = useState(initialValues?.amount || '');
  const [pending, setPending] = useState(initialValues?.pending || false);
  const [destinationAccountId, setDestinationAccountId] = useState(initialValues?.destinationAccountId || '');

  const predictionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);

    if (predictionTimeoutRef.current) {
      clearTimeout(predictionTimeoutRef.current);
    }

    if (mode === 'standard' && accountId && value.length >= 3 && !categoryId) {
      predictionTimeoutRef.current = setTimeout(() => {
        predictCategory({ accountId, description: value }, {
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

  const currentValues: TransactionFormValues = {
    date,
    description,
    categoryId,
    tagIds,
    amount,
    pending,
    destinationAccountId,
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(currentValues);
  };

  const availableDestinations = accounts?.filter(a => a.id !== accountId) || [];
  const isFormValid = accountId && description && amount && (mode === 'standard' || (mode === 'transfer' && destinationAccountId));

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
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
        <>
          <div className="space-y-2 flex flex-col">
            <label className="text-sm font-medium">{t('fields.category')}</label>
            <CategorySelector 
              key={accountId}
              accountId={accountId}
              value={categoryId}
              onChange={setCategoryId}
            />
          </div>

          <div className="space-y-2 flex flex-col">
            <label className="text-sm font-medium">Tags</label>
            {accountId && (
              <TagSelector 
                accountId={accountId} 
                selectedTagIds={tagIds} 
                onChange={setTagIds} 
              />
            )}
          </div>
        </>
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

      <div className="flex flex-col gap-3 pt-4">
        {onAddAnother && (
          <Button 
            type="button"
            variant="outline"
            className="w-full h-11 text-base flex justify-between px-4" 
            onClick={() => onAddAnother(currentValues)}
            disabled={isPending || !isFormValid}
          >
            <span>{isPending ? tc('loading') : t('save_another')}</span>
            <kbd className="hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              Enter
            </kbd>
          </Button>
        )}
        <Button 
          type="submit"
          className="w-full h-11 text-base font-semibold flex justify-between px-4" 
          disabled={isPending || !isFormValid}
        >
          <span>{isPending ? tc('loading') : submitLabel}</span>
          <kbd className="hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-primary-foreground/20 px-1.5 font-mono text-[10px] font-medium text-primary-foreground opacity-100">
            <span className="text-xs">⇧</span> Enter
          </kbd>
        </Button>
      </div>
    </form>
  );
}
