'use client';

import { useAIInsights } from '../api/use-ai-insights';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2 } from 'lucide-react';
import { useLocale } from 'next-intl';

interface AIInsightsCardProps {
  accountId: string | null;
  periodId: string | null;
}

export function AIInsightsCard({ accountId, periodId }: AIInsightsCardProps) {
  const locale = useLocale();
  const { data: insights, isLoading, isError } = useAIInsights(accountId, periodId, locale);

  if (!accountId || !periodId) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Analyse IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Génération de l'analyse en cours...
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground italic">
            Impossible de charger les analyses IA pour le moment.
          </p>
        ) : (
          <div className="text-sm space-y-2 leading-relaxed whitespace-pre-line">
            {insights}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
