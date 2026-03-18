'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from "@/lib/utils";

interface BaseAIInsightsCardProps {
  title: string;
  icon: React.ReactNode;
  insights: string | null | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRefetch: () => void;
  loadingMessage?: string;
  errorMessage?: string;
  className?: string;
  headerClassName?: string;
}

export function BaseAIInsightsCard({
  title,
  icon,
  insights,
  isLoading,
  isError,
  isFetching,
  onRefetch,
  loadingMessage = "Génération de l'analyse en cours...",
  errorMessage = "Impossible de charger les analyses IA pour le moment.",
  className,
  headerClassName,
}: BaseAIInsightsCardProps) {
  return (
    <Card className={cn("border-2 border-border shadow-sm relative group overflow-hidden flex flex-col", className)}>
      <CardHeader className={cn("pb-3 flex flex-row items-center justify-between space-y-0 bg-muted/10 shrink-0", headerClassName)}>
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {!isLoading && (
          <Button 
            variant="ghost" 
            size="icon-xs" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRefetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-2 overflow-y-auto flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingMessage}
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground italic">
            {errorMessage}
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
