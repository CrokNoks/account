'use client';

import { ComparisonPoint } from '../model/types';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/shared/lib/format';
import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { isSurplus, spentAmount } from '../lib/budget-surplus';

const abs = (value: string): bigint => {
  const n = BigInt(value);
  return n < BigInt(0) ? -n : n;
};

// percentageDiff is the change of the amount: positive means more money (spent or received).
// The gap in euros is the same change on the amounts (absolute values, bigint), shown before the percentage.
// Direction is carried by the arrow and the sign, never by the colour alone.
export function ComparisonGap({ item, isExpense, isSavings }: { item: ComparisonPoint, isExpense?: boolean, isSavings?: boolean }) {
  const formatCurrency = useFormatCurrency();
  const t = useTranslations('Reporting.comparison');
  const locale = useLocale();
  // Une dépense dont le réel est positif (remboursement) ne consomme rien : l'écart porte sur le montant consommé,
  // comme le montant affiché. Sans remboursement, le réel brut et le pourcentage de l'API s'appliquent tels quels.
  const surplus = !!isExpense && (isSurplus(BigInt(item.period1Real)) || isSurplus(BigInt(item.period2Real)));
  const base = surplus ? spentAmount(BigInt(item.period1Real)) : abs(item.period1Real);
  const compared = surplus ? spentAmount(BigInt(item.period2Real)) : abs(item.period2Real);
  const isNew = base === BigInt(0) && compared !== BigInt(0);
  const amountGap = compared - base;
  const percentageDiff = !surplus ? item.percentageDiff
    : base === BigInt(0) ? 0
    : Number((amountGap * BigInt(10000)) / base) / 100;
  const percent = formatPercent(percentageDiff, locale, { signed: true });
  const isUp = isNew || percentageDiff > 0;
  const isNeutral = !isNew && percentageDiff === 0;
  // More spending is bad, more income is good
  const isGood = isExpense ? !isUp : isUp;

  return (
    <span
      data-testid="comparison-gap"
      className={cn(
        "text-xs font-bold inline-flex items-center justify-end gap-1",
        // Épargner plus n'est ni bon ni mauvais ici : couleur neutre, le sens reste porté par la flèche et le signe.
        isNeutral || isSavings ? "text-muted-foreground" : (isGood ? "text-primary" : "text-warn")
      )}
    >
      {isNeutral ? <Minus className="w-3 h-3" /> : (isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
      {isNew ? t('new') : `${amountGap > BigInt(0) ? '+' : ''}${formatCurrency(amountGap)} ${percent}`}
    </span>
  );
}
