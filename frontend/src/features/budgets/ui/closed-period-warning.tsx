'use client';

import { useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';
import { Period } from '@/features/periods/model/types';

/** Avertit, avant tout enregistrement, qu'agir sur une période fermée change des dépassements passés. */
export function ClosedPeriodWarning({ period }: { period: Period | undefined }) {
  const t = useTranslations('BudgetsScreen');
  if (!period || period.isActive) return null;
  return (
    <div
      role="alert"
      data-testid="closed-period-warning"
      className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{t('closed_warning')}</span>
    </div>
  );
}
