'use client';

import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useAnomalies, Anomaly } from '../api/use-anomalies';
import { AlertCircle, Copy, ArrowUpRight, TrendingUp, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function AnomaliesWidget() {
  const { activeAccountId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  
  const activePeriod = periods?.find(p => p.isActive);
  const { data: anomalies, isLoading } = useAnomalies(activeAccountId, activePeriod?.id);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  if (isLoading) return null;

  const activeAnomalies = anomalies?.filter(a => !dismissedIds.has(a.id)) || [];

  if (activeAnomalies.length === 0) return null;

  const dismiss = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
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
    <Card className="border-orange-500/50 shadow-sm bg-orange-500/5">
      <CardHeader className="pb-3 flex flex-row items-center gap-2 space-y-0">
        <AlertCircle className="w-5 h-5 text-orange-500" />
        <CardTitle className="text-sm font-bold text-orange-700 uppercase tracking-wider">
          Anomalies détectées ({activeAnomalies.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
              {/* Optional: Add a button to open specific transactions */}
            </div>
            <Button 
              variant="ghost" 
              size="icon-xs" 
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => dismiss(anomaly.id)}
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
