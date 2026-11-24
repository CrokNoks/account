'use client';

import { useState, useRef, useEffect, useId } from 'react';
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
import { cn } from '@/lib/utils';
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
  /** Mobile : le sens porte le signe (le champ montant n'en contient pas). Absent = Dépense. */
  direction?: 'expense' | 'income';
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
  const dateId = useId();
  const descriptionId = useId();
  const categoryFieldId = useId();
  const tagsId = useId();
  const destinationId = useId();
  const amountId = useId();

  const [date, setDate] = useState(initialValues?.date || todayDateOnly());
  const [description, setDescription] = useState(initialValues?.description || '');
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId || '');
  const [tagIds, setTagIds] = useState<string[]>(initialValues?.tagIds || []);
  const [amount, setAmount] = useState(initialValues?.amount || '');
  const [direction, setDirection] = useState<'expense' | 'income'>(initialValues?.direction || 'expense');
  const [pending, setPending] = useState(initialValues?.pending || false);
  const [destinationAccountId, setDestinationAccountId] = useState(initialValues?.destinationAccountId || '');

  const predictionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Mobile : le curseur est sur Montant à l'ouverture et après une remise à zéro (nouvelle clé du formulaire).
  useEffect(() => {
    if (!desktop) amountInputRef.current?.focus();
  }, [desktop]);
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
    direction,
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(currentValues);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    // Let native behaviour handle Enter in textareas
    if (target.tagName === 'TEXTAREA') return;
    // Mobile : Entrée/Go n'envoie rien ; partout, Entrée ne relance pas un envoi en cours.
    if (!desktop || isPending) {
      if (target.tagName === 'INPUT') e.preventDefault();
      return;
    }
    if (!e.shiftKey && onAddAnother && isFormValid) {
      e.preventDefault();
      onAddAnother(currentValues);
    }
  };

  const availableDestinations = accounts?.filter(a => a.id !== accountId) || [];
  const isFormValid = accountId && description && amount && (mode === 'standard' || (mode === 'transfer' && destinationAccountId));

  const tagsField = (
    <div className="space-y-2 flex flex-col">
      <label htmlFor={tagsId} className="text-sm font-medium">{t('filters.tags')}</label>
      {accountId && (
        <TagSelector
          id={tagsId}
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

  const dateField = (
    <div className="space-y-2" data-tour="tx-date">
      <label htmlFor={dateId} className="text-sm font-medium">{t('fields.date')}</label>
      <Input 
        id={dateId}
        ref={dateInputRef}
        type="date" 
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        className="h-11"
      />
    </div>
  );

  const descriptionField = (
    <div className="space-y-2" data-tour="tx-description">
      <label htmlFor={descriptionId} className="text-sm font-medium">{t(desktop ? 'fields.description' : 'fields.label')}</label>
      <Input 
        id={descriptionId}
        placeholder={mode === 'transfer' ? t('form.description_placeholder_transfer') : t('form.description_placeholder_standard')} 
        value={description}
        onChange={(e) => handleDescriptionChange(e.target.value)}
        required
        className="h-11"
      />
    </div>
  );

  const categoryField = (
    <div className="space-y-2 flex flex-col">
      <label htmlFor={categoryFieldId} className="text-sm font-medium">{t('fields.category')}</label>
      <CategorySelector 
        id={categoryFieldId}
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
  );

  const destinationField = (
    <div className="space-y-2">
      <label htmlFor={destinationId} className="text-sm font-medium">{t('form.destination_account')}</label>
      <Select value={destinationAccountId} onValueChange={(v) => setDestinationAccountId(v || '')}>
        <SelectTrigger id={destinationId} className="h-11">
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
  );

  const amountField = (
    <div className="space-y-2" data-tour="tx-amount">
      <label htmlFor={amountId} className="text-sm font-medium">{t('fields.amount')}</label>
      <div className="relative">
        <AmountInput
          id={amountId}
          ref={amountInputRef}
          variant={desktop ? 'signed' : 'unsigned'}
          placeholder={tc('amount_placeholder')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="pr-12 h-11 text-lg font-semibold"
          required
        />
        <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">€</span>
      </div>
      {desktop && mode === 'standard' && (
        <p className="text-[10px] max-lg:text-xs text-muted-foreground italic">{t('expense_hint')}</p>
      )}
    </div>
  );

  const directionField = (
    <div role="group" className="grid grid-cols-2 gap-2">
      {(['expense', 'income'] as const).map((value) => (
        <Button
          key={value}
          type="button"
          variant={direction === value ? 'default' : 'outline'}
          aria-pressed={direction === value}
          onClick={() => setDirection(value)}
          className={cn('min-h-11 text-base')}
        >
          {t(`direction_${value}`)}
        </Button>
      ))}
    </div>
  );

  const submitButton = (
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
  );

  return (
    <form onSubmit={handleFormSubmit} onKeyDown={handleKeyDown} className="space-y-6">
      {desktop ? (
        <>
          {dateField}
          {descriptionField}
          {mode === 'standard' && (
            <>
              {categoryField}
              {tagsField}
            </>
          )}
          {mode === 'transfer' && destinationField}
          {amountField}
          {mode === 'standard' && pendingField}
        </>
      ) : (
        <>
          {mode === 'standard' && directionField}
          {amountField}
          {descriptionField}
          {mode === 'standard' ? categoryField : destinationField}
          {dateField}
          {(mode === 'standard' || onModeChange) && (
            <MoreOptions defaultOpen={mode === 'transfer'}>
              {mode === 'standard' && tagsField}
              {mode === 'standard' && pendingField}
              {onModeChange && transferField}
            </MoreOptions>
          )}
        </>
      )}

      <div className="flex flex-col gap-3 pt-4">
        {!desktop && submitButton}
        {onAddAnother && (
          <Button 
            type="button"
            variant="outline"
            className="w-full h-11 text-base flex justify-between px-4" 
            onClick={() => onAddAnother(currentValues)}
            disabled={isPending || !isFormValid}
          >
            <span>{isPending ? tc('loading') : desktop ? t('save_another') : t('add_another')}</span>
            <kbd className="hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              Enter
            </kbd>
          </Button>
        )}
        {desktop && submitButton}
      </div>
    </form>
  );
}
