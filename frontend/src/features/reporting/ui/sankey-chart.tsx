'use client';

import { useSankeyData } from '../api/use-sankey-data';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts';
import { Loader2, GitBranch } from 'lucide-react';

interface SankeyChartProps {
  accountId: string | null;
  periodId: string | null;
}

export function SankeyChart({ accountId, periodId }: SankeyChartProps) {
  const { data, isLoading } = useSankeyData(accountId, periodId);

  if (!accountId || !periodId) return null;

  return (
    <Card className="h-[500px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary" />
          Flux de trésorerie (Sankey)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[420px]">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.links.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Pas assez de données pour générer le diagramme.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={data as any}
              node={{ stroke: '#6366f1', strokeWidth: 1 }}
              link={{ stroke: '#6366f1', fillOpacity: 0.1 }}
              nodePadding={40}
              margin={{ top: 20, right: 100, bottom: 20, left: 10 }}
            >
              <Tooltip 
                formatter={(value: any) => [`${value}€`, 'Montant']}
              />
            </Sankey>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
