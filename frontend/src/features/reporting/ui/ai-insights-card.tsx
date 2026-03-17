'use client';

import { useAIInsights } from '../api/use-ai-insights';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { useLocale } from 'next-intl';
import ReactMarkdown from 'react-markdown';

interface AIInsightsCardProps {
  accountId: string | null;
  periodId: string | null;
}

export function AIInsightsCard({ accountId, periodId }: AIInsightsCardProps) {
  const locale = useLocale();
  const { data: insights, isLoading, isError, refetch, isFetching } = useAIInsights(accountId, periodId, locale);

  if (!accountId || !periodId) return null;

  return (
    <Card className="border-2 border-primary/20 bg-primary/5 relative group h-full overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 bg-muted/10">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Analyse IA
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
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Génération de l&apos;analyse en cours...
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground italic">
            Impossible de charger les analyses IA pour le moment.
          </p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-li:my-0">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
