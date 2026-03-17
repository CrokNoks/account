'use client';

import { useBudgetBreakdown } from '../api/use-budget-breakdown';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '@/shared/lib/format';
import { PieChart as PieChartIcon } from 'lucide-react';

export function TopExpensesWidget() {
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: breakdown, isLoading } = useBudgetBreakdown(activeAccountId, activePeriodId);

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;
  if (!breakdown || !breakdown.expenses || breakdown.expenses.length === 0) return null;

  // Transform and sort data for Donut Chart
  const chartData = breakdown.expenses
    .map(item => ({
      name: item.name,
      value: Math.abs(parseInt(item.real, 10)) / 100
    }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // Top 5

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <Card className="h-full border-2 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 bg-muted/10">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <PieChartIcon className="w-4 h-4 text-primary" />
          Top Dépenses
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any) => formatCurrency(Math.round(Number(value) * 100))}
                contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend 
                verticalAlign="bottom" 
                align="center"
                wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
