'use client';

import { useNetWorth } from '../api/use-net-worth';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/shared/lib/format';
import { Landmark } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

export function NetWorthWidget() {
  const { activeAccountId } = useAccountStore();
  const { data, isLoading } = useNetWorth(activeAccountId);

  if (isLoading) return <div className="h-32 bg-muted animate-pulse rounded-xl" />;
  if (!data) return null;

  const amount = parseInt(data.currentTotal, 10);
  const colorClass = amount < 0 ? "text-red-500" : "text-green-500";

  // Data for Sparkline
  const chartData = data.history.map(point => ({
    value: parseInt(point.amount, 10) / 100
  }));

  return (
    <Card className="h-full border-2 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 bg-muted/10">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Patrimoine Net (Tous comptes)</CardTitle>
        <Landmark className="w-4 h-4 text-primary" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <div className={`text-2xl font-bold ${colorClass}`}>
          {formatCurrency(data.currentTotal)}
        </div>
        
        <div className="h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="currentColor" 
                strokeWidth={2} 
                dot={false} 
                className="text-primary"
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border rounded p-1 text-[10px] shadow-sm">
                        {formatCurrency(Math.round(Number(payload[0].value) * 100))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
