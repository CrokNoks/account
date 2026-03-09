'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/shared/lib/format";
import { useAccountStore } from "@/features/accounts/model/use-account-store";
import { useEvolution } from "../api/use-evolution";
import { useCategories } from "@/features/categories/api/use-categories";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar
} from 'recharts';

export function EvolutionChart() {
  const t = useTranslations('Reporting');
  const locale = useLocale();
  const dateLocale = locale === 'fr' ? fr : enUS;
  
  const { activeAccountId } = useAccountStore();
  const { data: evolutionData, isLoading: isLoadingEvolution } = useEvolution(activeAccountId);
  const { data: categories, isLoading: isLoadingCategories } = useCategories(activeAccountId);

  if (isLoadingEvolution || isLoadingCategories) return <div className="h-96 bg-muted animate-pulse rounded-xl" />;
  if (!evolutionData || evolutionData.length === 0) return null;

  const chartData = evolutionData.map(d => {
    const balance = parseInt(d.realBankBalance, 10) / 100;
    const income = parseInt(d.realIncome, 10) / 100;
    const expenses = Math.abs(parseInt(d.realExpenses, 10) / 100);
    
    const dataPoint: any = {
      name: format(new Date(d.startDate), 'MMM yy', { locale: dateLocale }),
      balance,
      income,
      expenses,
    };

    // Add individual category data
    Object.entries(d.categories).forEach(([catId, amount]) => {
      const category = categories?.find(c => c.id === catId);
      if (category && category.type === 'expense') {
        dataPoint[category.name] = Math.abs(parseInt(amount, 10)) / 100;
      }
    });

    return dataPoint;
  });

  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('balance_evolution')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${value}€`}
                  dx={-10}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency((value * 100).toString())}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  name={t('real_bank_balance')} 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorBalance)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('income_vs_expenses')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `${value}€`}
                    dx={-10}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency((value * 100).toString())}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Legend iconType="circle" />
                  <Line type="monotone" dataKey="income" name={t('income')} stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expenses" name={t('expenses')} stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition des dépenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `${value}€`}
                    dx={-10}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency((value * 100).toString())}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Legend iconType="circle" />
                  {expenseCategories.map((cat) => (
                    <Bar 
                      key={cat.id} 
                      dataKey={cat.name} 
                      stackId="a" 
                      fill={cat.color} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
