'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AmountInput } from '@/components/ui/amount-input';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { fromCents, isUnreadableAmount, toCents } from '@/shared/lib/format';
import { useBudgetTemplates } from '../api/use-budget-templates';
import { useSaveBudgetTemplates } from '../api/use-save-budget-templates';

export function BudgetTemplatesForm() {
  const t = useTranslations('BudgetTemplates');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { data: lines, isLoading } = useBudgetTemplates(activeAccountId);
  const { mutate: save, isPending } = useSaveBudgetTemplates();
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  // Relu à chaque rechargement : une catégorie ajoutée/supprimée apparaît/disparaît.
  useEffect(() => {
    if (!lines) return;
    const initial: Record<string, string> = {};
    lines.forEach((l) => {
      initial[l.categoryId] = fromCents(l.amount);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmounts(initial);
  }, [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId || !lines) return;
    if (lines.some((l) => isUnreadableAmount(amounts[l.categoryId] ?? ''))) {
      toast.error(tc('invalid_amount'));
      return;
    }
    save(
      {
        accountId: activeAccountId,
        items: lines.map((l) => ({
          categoryId: l.categoryId,
          amount: toCents(amounts[l.categoryId] ?? ''),
        })),
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
                value={amounts[line.categoryId] ?? ''}
                onChange={(e) => setAmounts({ ...amounts, [line.categoryId]: e.target.value })}
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
