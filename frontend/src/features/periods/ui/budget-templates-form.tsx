'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AmountInput } from '@/components/ui/amount-input';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { buildBudgets, displayValue, draftErrors, type Drafts, type SavedBudget } from '@/features/budgets/model/budget-draft';
import { useBudgetTemplates } from '../api/use-budget-templates';
import { useSaveBudgetTemplates } from '../api/use-save-budget-templates';

export function BudgetTemplatesForm() {
  const t = useTranslations('BudgetTemplates');
  const tc = useTranslations('Common');
  const tb = useTranslations('BudgetsScreen');
  const locale = useLocale();
  const { activeAccountId } = useAccountStore();
  const { data: lines, isLoading } = useBudgetTemplates(activeAccountId);
  const { mutate: save, isPending } = useSaveBudgetTemplates();
  // Saisies non enregistrées ; le reste est affiché depuis `lines`, comme sur l'écran Budgets.
  const [drafts, setDrafts] = useState<Drafts>({});
  const reference = useMemo<SavedBudget[]>(
    () => (lines ?? []).map((l) => ({ categoryId: l.categoryId, amountAllocated: l.amount })),
    [lines],
  );

  // Relu à chaque rechargement : une catégorie ajoutée/supprimée apparaît/disparaît.
  useEffect(() => {
    if (!lines) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrafts({});
  }, [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId || !lines) return;
    const errors = Object.values(draftErrors(reference, drafts));
    if (errors.length > 0) {
      toast.error(errors.includes('unreadable') ? tc('invalid_amount') : tb('negative_amount'));
      return;
    }
    save(
      {
        accountId: activeAccountId,
        items: buildBudgets(reference, drafts).map((b) => ({ categoryId: b.categoryId, amount: b.amountAllocated })),
      },
      {
        onSuccess: () => toast.success(t('saved')),
        onError: () => toast.error(t('save_failed')),
      },
    );
  };

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">{tc('loading')}</div>;
  }
  if (!lines || lines.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">{t('no_categories')}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border rounded-xl divide-y overflow-hidden bg-background shadow-sm">
        {lines.map((line) => (
          <div key={line.categoryId} className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{line.name}</p>
              {line.isProposal && (
                <p className="text-[10px] max-lg:text-xs text-muted-foreground mt-1">
                  {t('proposal_hint')}
                </p>
              )}
            </div>
            <div className="w-32">
              <AmountInput
                value={displayValue(reference, drafts, line.categoryId, locale)}
                onChange={(e) => setDrafts({ ...drafts, [line.categoryId]: e.target.value })}
                className="text-right h-10 font-bold"
              />
            </div>
          </div>
        ))}
      </div>
      <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isPending}>
        {isPending ? tc('loading') : tc('save')}
      </Button>
    </form>
  );
}
