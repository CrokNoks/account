'use client';

import { useEvolutionAIInsights } from '../api/use-evolution-ai-insights';
import { BaseAIInsightsCard } from './base-ai-insights-card';
import { TrendingUp } from 'lucide-react';
import { useLocale } from 'next-intl';

interface EvolutionAIInsightsCardProps {
  accountId: string | null;
}

export function EvolutionAIInsightsCard({ accountId }: EvolutionAIInsightsCardProps) {
  const locale = useLocale();
  const { data: insights, isLoading, isError, refetch, isFetching } = useEvolutionAIInsights(accountId, locale);

  if (!accountId) return null;

  return (
    <BaseAIInsightsCard
      title="Analyse des Tendances IA"
      icon={<TrendingUp className="w-4 h-4 text-primary" />}
      insights={insights}
      isLoading={isLoading}
      isError={isError}
      isFetching={isFetching}
      onRefetch={refetch}
      className="border-primary/20 bg-primary/5"
      headerClassName="bg-transparent"
      loadingMessage="Analyse des données historiques en cours..."
    />
  );
}
