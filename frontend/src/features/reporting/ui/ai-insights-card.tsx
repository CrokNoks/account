'use client';

import { useAIInsights } from '../api/use-ai-insights';
import { BaseAIInsightsCard } from './base-ai-insights-card';
import { Sparkles } from 'lucide-react';
import { useLocale } from 'next-intl';

interface AIInsightsCardProps {
  accountId: string | null;
  periodId: string | null;
}

export function AIInsightsCard({ accountId, periodId }: AIInsightsCardProps) {
  const locale = useLocale();
  const { data: insights, isLoading, isError, refetch, isFetching } = useAIInsights(accountId, periodId, locale);

  if (!accountId || !periodId) return null;

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
