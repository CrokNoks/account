'use client';

import { useSankeyData } from '../api/use-sankey-data';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle, SankeyData } from 'recharts';
import { Loader2, GitBranch } from 'lucide-react';

interface SankeyChartProps {
  accountId: string | null;
  periodId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
  const isOut = (x || 0) + (width || 0) + 6 > (containerWidth || 0);
  return (
    <Layer key={`node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload?.color || '#6366f1'}
        fillOpacity={0.8}
        rx={2}
      />
      <text
        x={isOut ? (x || 0) - 6 : (x || 0) + (width || 0) + 6}
        y={(y || 0) + (height || 0) / 2}
        textAnchor={isOut ? 'end' : 'start'}
        dominantBaseline="central"
        fontSize="10"
        fontWeight="bold"
        fill="currentColor"
        className="fill-foreground"
      >
        {payload?.name}
      </text>
    </Layer>
  );
};

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
              data={data as unknown as SankeyData}
              node={<CustomNode />}
              link={{ stroke: '#6366f1', fillOpacity: 0.1 }}
              nodePadding={40}
              margin={{ top: 20, right: 120, bottom: 20, left: 120 }}
            >
              <Tooltip 
                formatter={(value: unknown) => [`${value as string}€`, 'Montant']}
              />
            </Sankey>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
