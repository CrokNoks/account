'use client';

import { useEvolutionAIInsights } from '../api/use-evolution-ai-insights';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useLocale } from 'next-intl';
import ReactMarkdown from 'react-markdown';

interface EvolutionAIInsightsCardProps {
  accountId: string | null;
}

export function EvolutionAIInsightsCard({ accountId }: EvolutionAIInsightsCardProps) {
  const locale = useLocale();
  const { data: insights, isLoading, isError, refetch, isFetching } = useEvolutionAIInsights(accountId, locale);

  if (!accountId) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 relative group">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Analyse des Tendances IA
        </CardTitle>
        {!isLoading && (
          <Button 
            variant="ghost" 
            size="icon-xs" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyse des données historiques en cours...
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground italic">
            Impossible de charger l&apos;analyse des tendances pour le moment.
          </p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-li:my-0">
            <ReactMarkdown>{insights || ''}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
