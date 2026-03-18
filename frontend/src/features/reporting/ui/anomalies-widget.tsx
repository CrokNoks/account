'use client';

import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useAnomalies } from '../api/use-anomalies';
import { Anomaly } from '../model/types';
import { useIgnoreAnomaly } from '../api/use-ignore-anomaly';
import { AlertCircle, Copy, ArrowUpRight, TrendingUp, X, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

export function AnomaliesWidget() {
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: anomalies, isLoading } = useAnomalies(activeAccountId, activePeriodId);
  const { mutate: ignoreAnomaly } = useIgnoreAnomaly(activePeriodId);
  
  // Keep local state for immediate optimistic UI update
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const activeAnomalies = anomalies?.filter(a => !dismissedIds.has(a.id)) || [];

  if (isLoading) return null;

  if (activeAnomalies.length === 0) {
    return (
      <Card className="border-2 border-emerald-500/30 shadow-sm h-full overflow-hidden bg-emerald-500/5 flex flex-col items-center justify-center p-8 transition-all hover:bg-emerald-500/10">
        <div className="p-4 rounded-full bg-emerald-100 text-emerald-600 mb-4 animate-in zoom-in duration-500">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
          Tout est en ordre
        </CardTitle>
        <p className="text-xs text-emerald-600/70 mt-2 text-center font-medium">
          Aucune anomalie détectée pour cette période.
        </p>
      </Card>
    );
  }

  const dismiss = (anomaly: Anomaly) => {
    if (!activeAccountId) return;
    
    // Optimistic hide
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(anomaly.id);
      return next;
    });

    ignoreAnomaly(
      { 
        accountId: activeAccountId, 
        transactionIds: anomaly.transactionIds, 
        type: anomaly.type 
      },
      {
        onError: () => {
          // Revert optimistic update on error
          setDismissedIds(prev => {
            const next = new Set(prev);
            next.delete(anomaly.id);
            return next;
          });
          toast.error("Erreur lors de la mise à jour de l'anomalie");
        }
      }
    );
  };

  const getIcon = (type: Anomaly['type']) => {
    switch (type) {
      case 'duplicate': return <Copy className="w-4 h-4" />;
      case 'outlier': return <ArrowUpRight className="w-4 h-4" />;
      case 'spike': return <TrendingUp className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <Card className="border-2 border-orange-500/50 shadow-md h-full overflow-hidden bg-transparent flex flex-col">
      <CardHeader className="pb-3 flex flex-row items-center justify-start gap-2 space-y-0 bg-transparent shrink-0">
        <AlertCircle className="w-5 h-5 text-orange-500" />
        <CardTitle className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
          Anomalies détectées ({activeAnomalies.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-2 bg-transparent overflow-y-auto flex-1 min-h-0">
        {activeAnomalies.map((anomaly) => (
          <div 
            key={anomaly.id} 
            className="flex items-start gap-3 p-3 rounded-lg bg-background border shadow-sm relative group"
          >
            <div className={cn(
              "p-2 rounded-full mt-0.5",
              anomaly.severity === 'high' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
            )}>
              {getIcon(anomaly.type)}
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <h4 className="text-sm font-bold truncate">{anomaly.title}</h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {anomaly.description}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon-xs" 
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => dismiss(anomaly)}
              title="Ignorer cette alerte"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
