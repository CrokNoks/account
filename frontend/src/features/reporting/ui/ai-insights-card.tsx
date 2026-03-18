'use client';

import { useAIInsights } from '../api/use-ai-insights';
import { BaseAIInsightsCard } from './base-ai-insights-card';
import { Sparkles } from 'lucide-react';
import { useLocale } from 'next-intl';

import { useAccountStore } from '@/features/accounts/model/use-account-store';

export function AIInsightsCard() {
  const { activeAccountId, activePeriodId } = useAccountStore();
  const locale = useLocale();
  const { data: insights, isLoading, isError, refetch, isFetching } = useAIInsights(activeAccountId, activePeriodId, locale);

  if (!activeAccountId || !activePeriodId) return null;

  return (
    <BaseAIInsightsCard
      title="Analyse IA"
      icon={<Sparkles className="w-4 h-4 text-primary" />}
      insights={insights}
      isLoading={isLoading}
      isError={isError}
      isFetching={isFetching}
      onRefetch={refetch}
      className="h-full"
    />
  );
}
