'use client';

import { useState } from 'react';
import { usePeriodComparison } from '../api/use-period-comparison';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from '@/shared/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowUpRight, ArrowDownRight, Minus, Scale } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PeriodComparisonProps {
  accountId: string | null;
  periodId: string | null;
}

export function PeriodComparison({ accountId, periodId }: PeriodComparisonProps) {
  const { data: periods } = usePeriods(accountId);
  const [compareWithId, setCompareWithId] = useState<string | null>(null);
  
  const { data: comparison, isLoading } = usePeriodComparison(accountId, periodId, compareWithId);

  const otherPeriods = periods?.filter(p => p.id !== periodId) || [];

  if (!accountId || !periodId) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          Comparaison de périodes
        </CardTitle>
        <Select value={compareWithId || ''} onValueChange={setCompareWithId}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="Comparer avec..." />
          </SelectTrigger>
          <SelectContent>
            {otherPeriods.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {format(new Date(p.startDate), 'MMM yy')} - {format(new Date(p.endDate), 'MMM yy')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!compareWithId ? (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            Sélectionnez une période pour comparer les résultats.
          </div>
        ) : isLoading ? (
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <ComparisonTable title="Dépenses" data={comparison?.expenses || []} isExpense />
            <ComparisonTable title="Revenus" data={comparison?.income || []} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonTable({ title, data, isExpense }: { title: string, data: any[], isExpense?: boolean }) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8">Catégorie</TableHead>
            <TableHead className="h-8 text-right">Période A</TableHead>
            <TableHead className="h-8 text-right">Période B</TableHead>
            <TableHead className="h-8 text-right">Écart</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const diff = parseInt(item.diff, 10);
            const isNegative = diff < 0;
            const isNeutral = diff === 0;
            
            // For expenses, a negative diff (Period B < Period A) is GOOD (green)
            const isGood = isExpense ? isNegative : !isNegative;

            return (
              <TableRow key={item.categoryId}>
                <TableCell className="py-2 text-sm font-medium">{item.name}</TableCell>
                <TableCell className="py-2 text-right text-xs text-muted-foreground">
                  {formatCurrency(item.period1Real)}
                </TableCell>
                <TableCell className="py-2 text-right text-sm">
                  {formatCurrency(item.period2Real)}
                </TableCell>
                <TableCell className={cn(
                  "py-2 text-right text-xs font-bold flex items-center justify-end gap-1",
                  isNeutral ? "text-muted-foreground" : (isGood ? "text-emerald-600" : "text-rose-600")
                )}>
                  {isNeutral ? <Minus className="w-3 h-3" /> : (isGood ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />)}
                  {item.percentageDiff}%
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
