'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { EvolutionTooltip } from './evolution/evolution-tooltip';
import { CategoryFilterSidebar } from './evolution/category-filter-sidebar';

export function EvolutionChart() {
  const t = useTranslations('Reporting');
  const locale = useLocale();
  const dateLocale = locale === 'fr' ? fr : enUS;
  
  const { activeAccountId } = useAccountStore();
  const { data: rawEvolutionData, isLoading: isLoadingEvolution } = useEvolution(activeAccountId);
  const { data: categories, isLoading: isLoadingCategories } = useCategories(activeAccountId);

  // Only consider closed periods for the chart
  const evolutionData = useMemo(() => {
    if (!rawEvolutionData) return [];
    return rawEvolutionData.filter(d => !d.isActive);
  }, [rawEvolutionData]);

  const { expenseCategories, sortedCategories } = useMemo(() => {
    const base = categories?.filter(c => c.type === 'expense') || [];
    
    if (!evolutionData || evolutionData.length === 0) return { expenseCategories: base, sortedCategories: base };

    // Calculate variance for each category
    const withVariance = base.map(cat => {
      const values = evolutionData.map(d => 
        Math.abs(parseInt(d.categories?.[cat.id] || '0', 10))
      );
      const min = Math.min(...values);
      const max = Math.max(...values);
      return { ...cat, variance: max - min };
    });

    // Sort by variance descending
    const sorted = [...withVariance].sort((a, b) => b.variance - a.variance);
    
    return { 
      expenseCategories: base, 
      sortedCategories: sorted 
    };
  }, [categories, evolutionData]);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string> | null>(null);

  // Compute actual selection (either from state or default top 5)
  const currentSelection = useMemo(() => {
    if (selectedCategoryIds) return selectedCategoryIds;
    
    if (sortedCategories.length > 0 && 'variance' in sortedCategories[0]) {
      const top5Ids = sortedCategories
        .slice(0, 5)
        .map(v => v.id);
      return new Set(top5Ids);
    }
    
    return new Set<string>();
  }, [selectedCategoryIds, sortedCategories]);

  const toggleCategory = (id: string) => {
    const newSet = new Set(currentSelection);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCategoryIds(newSet);
  };

  const toggleAll = () => {
    if (currentSelection.size === expenseCategories.length) {
      setSelectedCategoryIds(new Set());
    } else {
      setSelectedCategoryIds(new Set(expenseCategories.map(c => c.id)));
    }
  };

  if (isLoadingEvolution || isLoadingCategories) return <div className="h-96 bg-muted animate-pulse rounded-xl" />;
  
  if (!evolutionData || evolutionData.length === 0) {
    return <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground italic">Aucune donnée d&apos;évolution disponible</div>;
  }

  const chartData: Array<Record<string, string | number>> = evolutionData.map(d => {
    const balance = parseInt(d.realBankBalance, 10) / 100;
    const income = parseInt(d.realIncome, 10) / 100;
    const expenses = Math.abs(parseInt(d.realExpenses, 10) / 100);
    
    const dataPoint: Record<string, string | number> = {
      name: format(new Date(d.startDate), 'MMM yy', { locale: dateLocale }),
      balance,
      income,
      expenses,
    };

    if (d.categories) {
      Object.entries(d.categories).forEach(([catId, amount]) => {
        const category = categories?.find(c => c.id === catId);
        if (category && category.type === 'expense') {
          dataPoint[category.name] = Math.abs(parseInt(amount, 10)) / 100;
        }
      });
    }

    return dataPoint;
  });

  return (
    <div className="space-y-8 pb-10" data-tour="evolution">
      {/* Top row: Balance and Income/Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('balance_evolution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `${value}€`}
                    dx={-10}
                  />
                  <Tooltip content={<EvolutionTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="balance" 
                    name={t('real_bank_balance')} 
                    stroke="#38bdf8" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorBalance)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('income_vs_expenses')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `${value}€`}
                    dx={-10}
                  />
                  <Tooltip content={<EvolutionTooltip />} />
                  <Legend iconType="circle" verticalAlign="top" height={36}/>
                  <Line type="monotone" dataKey="income" name={t('income')} stroke="#22c55e" strokeWidth={4} dot={{ r: 4, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="expenses" name={t('expenses')} stroke="#f43f5e" strokeWidth={4} dot={{ r: 4, fill: "#f43f5e", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full width: Category Breakdown with Sidebar */}
      <div className="hidden lg:block">
        <Card>
          <CardHeader>
            <CardTitle>Répartition des dépenses par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-8">
              <CategoryFilterSidebar 
                categories={sortedCategories}
                selectedIds={currentSelection}
                onToggle={toggleCategory}
                onToggleAll={toggleAll}
                isAllSelected={currentSelection.size === expenseCategories.length}
              />

              {/* Chart */}
              <div className="flex-1 h-[500px] min-h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis 
                      dataKey="name" 
                      stroke="currentColor" 
                      className="text-muted-foreground"
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="currentColor" 
                      className="text-muted-foreground"
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `${value}€`}
                      dx={-10}
                    />
                    <Tooltip content={<EvolutionTooltip />} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    {expenseCategories
                      .filter(cat => currentSelection.has(cat.id))
                      .map((cat) => (
                        <Bar 
                          key={cat.id} 
                          dataKey={cat.name} 
                          stackId="a" 
                          fill={cat.color} 
                        />
                      ))
                    }
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
