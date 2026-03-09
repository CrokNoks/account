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
  const [periodAId, setPeriodAId] = useState<string | null>(null);
  const [periodBId, setPeriodBId] = useState<string | null>(periodId);
  
  const { data: comparison, isLoading } = usePeriodComparison(accountId, periodBId, periodAId);

  const periodA = periods?.find(p => p.id === periodAId);
  const periodB = periods?.find(p => p.id === periodBId);

  const labelA = periodA ? format(new Date(periodA.startDate), 'MMM yy') : 'Période A';
  const labelB = periodB ? format(new Date(periodB.startDate), 'MMM yy') : 'Période B';

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          Comparaison de périodes
        </CardTitle>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-muted-foreground italic">Base (A) :</span>
            <Select value={periodAId || ''} onValueChange={setPeriodAId}>
              <SelectTrigger className="w-[160px] h-8 text-xs font-medium bg-muted/30">
                <SelectValue placeholder="Période A...">
                  {periodA ? format(new Date(periodA.startDate), 'MMMM yyyy') : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periods?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {format(new Date(p.startDate), 'MMMM yyyy')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-muted-foreground italic">Cible (B) :</span>
            <Select value={periodBId || ''} onValueChange={setPeriodBId}>
              <SelectTrigger className="w-[160px] h-8 text-xs font-medium bg-primary/5 border-primary/20">
                <SelectValue placeholder="Période B...">
                  {periodB ? format(new Date(periodB.startDate), 'MMMM yyyy') : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periods?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {format(new Date(p.startDate), 'MMMM yyyy')} {p.id === periodId && "(Actuelle)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!periodAId || !periodBId ? (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
            Sélectionnez deux périodes pour comparer les résultats.
          </div>
        ) : isLoading ? (
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row gap-4 p-3 bg-primary/5 rounded-lg border border-primary/10 text-[10px] sm:text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="font-semibold text-muted-foreground uppercase">Période A :</span> {periodA ? `${format(new Date(periodA.startDate), 'dd/MM/yy')} - ${format(new Date(periodA.endDate), 'dd/MM/yy')}` : ''}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="font-semibold text-primary uppercase">Période B :</span> {periodB ? `${format(new Date(periodB.startDate), 'dd/MM/yy')} - ${format(new Date(periodB.endDate), 'dd/MM/yy')}` : ''}
              </div>
            </div>

            <ComparisonTable title="Dépenses" data={comparison?.expenses || []} labelA={labelA} labelB={labelB} isExpense />
            <ComparisonTable title="Revenus" data={comparison?.income || []} labelA={labelA} labelB={labelB} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonTable({ title, data, labelA, labelB, isExpense }: { title: string, data: any[], labelA: string, labelB: string, isExpense?: boolean }) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <span className="w-8 h-[1px] bg-muted-foreground/30" />
        {title}
      </h4>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="h-8 text-xs">Catégorie</TableHead>
            <TableHead className="h-8 text-right text-xs">{labelA}</TableHead>
            <TableHead className="h-8 text-right text-xs font-bold text-foreground underline decoration-primary/30 underline-offset-4">{labelB}</TableHead>
            <TableHead className="h-8 text-right text-xs">Écart</TableHead>
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
