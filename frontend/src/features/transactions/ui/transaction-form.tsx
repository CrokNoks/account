'use client';

import { useState, useRef } from 'react';
import { todayDateOnly } from '@/shared/lib/date-only';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from '@/components/ui/amount-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TagSelector } from '@/features/tags/ui/tag-selector';
import { CategorySelector } from '@/features/categories/ui/category-selector';
import { useTranslations } from 'next-intl';
import { useAccounts } from '@/features/accounts/api/use-accounts';
import { usePredictCategory } from '../api/use-predict-category';
import { Sparkles } from 'lucide-react';
import { useIsDesktop } from '@/shared/lib/use-is-desktop';
import { MoreOptions } from './more-options';

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
  /** Mobile : le virement se choisit dans « Plus d'options » ; absent, aucun choix n'est proposé. */
  onModeChange?: (mode: 'standard' | 'transfer') => void;
}

export function TransactionForm({
  accountId,
  initialValues,
  onSubmit,
  isPending,
  submitLabel,
  mode = 'standard',
  onAddAnother,
  onModeChange,
}: TransactionFormProps) {
  const t = useTranslations('Transactions');
  const tc = useTranslations('Common');
  const { data: accounts } = useAccounts();
  const { mutate: predictCategory } = usePredictCategory();
  const desktop = useIsDesktop();

  const [date, setDate] = useState(initialValues?.date || todayDateOnly());
  const [description, setDescription] = useState(initialValues?.description || '');
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId || '');
  const [tagIds, setTagIds] = useState<string[]>(initialValues?.tagIds || []);
  const [amount, setAmount] = useState(initialValues?.amount || '');
  const [pending, setPending] = useState(initialValues?.pending || false);
  const [destinationAccountId, setDestinationAccountId] = useState(initialValues?.destinationAccountId || '');

  const predictionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  // Catégorie courante lue au retour de la prédiction : un choix fait entre-temps n'est jamais remplacé.
  const categoryRef = useRef(categoryId);
  const latestDescriptionRef = useRef(description);
  const [suggested, setSuggested] = useState(false);

  const chooseCategory = (value: string) => {
    categoryRef.current = value;
    setCategoryId(value);
    setSuggested(false);
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    latestDescriptionRef.current = value;

    if (predictionTimeoutRef.current) {
      clearTimeout(predictionTimeoutRef.current);
    }

    if (mode === 'standard' && accountId && value.trim().length >= 3 && !categoryRef.current) {
      predictionTimeoutRef.current = setTimeout(() => {
        predictCategory({ accountId, description: value }, {
          onSuccess: (data) => {
            // Réponse périmée (libellé modifié depuis) ou catégorie déjà choisie : on ne touche à rien.
            if (!data.categoryId || categoryRef.current || latestDescriptionRef.current !== value) return;
            categoryRef.current = data.categoryId;
            setCategoryId(data.categoryId);
            setSuggested(true);
          },
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const target = e.target as HTMLElement;
      // Let native behaviour handle Enter in textareas
      if (target.tagName === 'TEXTAREA') return;
      if (onAddAnother && isFormValid) {
        e.preventDefault();
        onAddAnother(currentValues);
      }
    }
  };

  const availableDestinations = accounts?.filter(a => a.id !== accountId) || [];
  const isFormValid = accountId && description && amount && (mode === 'standard' || (mode === 'transfer' && destinationAccountId));

  const tagsField = (
    <div className="space-y-2 flex flex-col">
      <label className="text-sm font-medium">{t('filters.tags')}</label>
      {accountId && (
        <TagSelector
          accountId={accountId}
          selectedTagIds={tagIds}
          onChange={setTagIds}
        />
      )}
    </div>
  );

  const pendingField = (
    <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30" data-tour="tx-pending">
      <Checkbox 
        id="pending-field" 
        checked={pending} 
        onCheckedChange={(checked) => setPending(!!checked)} 
      />
      <label htmlFor="pending-field" className="text-sm font-medium cursor-pointer select-none flex-1">
        {t('fields.pending')}
      </label>
      <p className="text-[10px] max-lg:text-xs text-muted-foreground">{t('form.excluded_from_forecast')}</p>
    </div>
  );

  const transferField = (
    <div className="flex items-center gap-2 min-h-11">
      <Checkbox
        id="transfer-field"
        checked={mode === 'transfer'}
        onCheckedChange={(checked) => onModeChange?.(checked ? 'transfer' : 'standard')}
      />
      <label htmlFor="transfer-field" className="text-sm font-medium cursor-pointer select-none flex-1">
        {t('mode_transfer')}
      </label>
    </div>
  );

  return (
    <form onSubmit={handleFormSubmit} onKeyDown={handleKeyDown} className="space-y-6">
      <div className="space-y-2" data-tour="tx-date">
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

      <div className="space-y-2" data-tour="tx-description">
        <label className="text-sm font-medium">{t('fields.description')}</label>
        <Input 
          placeholder={mode === 'transfer' ? t('form.description_placeholder_transfer') : t('form.description_placeholder_standard')} 
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
              onChange={chooseCategory}
            />
            {suggested && categoryId && (
              <p data-testid="suggested-category" className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3 text-yellow-500" />
                {t('suggested_category')}
              </p>
            )}
          </div>

          {desktop && tagsField}
        </>
      )}

      {mode === 'transfer' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('form.destination_account')}</label>
          <Select value={destinationAccountId} onValueChange={(v) => setDestinationAccountId(v || '')}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder={t('form.select_destination')}>
                {destinationAccountId ? availableDestinations.find(a => a.id === destinationAccountId)?.name : t('form.select_destination')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableDestinations.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">{t('form.no_other_account')}</div>
              ) : (
                availableDestinations.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2" data-tour="tx-amount">
        <label className="text-sm font-medium">{t('fields.amount')}</label>
        <div className="relative">
          <AmountInput
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pr-12 h-11 text-lg font-semibold"
            required
          />
          <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">€</span>
        </div>
        {mode === 'standard' && (
          <p className="text-[10px] max-lg:text-xs text-muted-foreground italic">{t('expense_hint')}</p>
        )}
      </div>

      {desktop && mode === 'standard' && pendingField}

      {!desktop && (mode === 'standard' || onModeChange) && (
        <MoreOptions defaultOpen={mode === 'transfer'}>
          {mode === 'standard' && tagsField}
          {mode === 'standard' && pendingField}
          {onModeChange && transferField}
        </MoreOptions>
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
