'use client';

import { useState } from 'react';
import { usePeriodComparison } from '../api/use-period-comparison';
import { ComparisonPoint } from '../model/types';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from '@/shared/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowUpRight, ArrowDownRight, Minus, Scale } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface PeriodComparisonProps {
  accountId: string | null;
  periodId: string | null;
}

export function PeriodComparison({ accountId, periodId }: PeriodComparisonProps) {
  const t = useTranslations('Reporting.comparison');
  const tr = useTranslations('Reporting');
  const dateLocale = useLocale() === 'fr' ? fr : enUS;
  const { data: periods } = usePeriods(accountId);
  const [periodAId, setPeriodAId] = useState<string | null>(null);
  const [periodBId, setPeriodBId] = useState<string | null>(periodId);
  
  const { data: comparison, isLoading } = usePeriodComparison(accountId, periodBId, periodAId);

  const periodA = periods?.find(p => p.id === periodAId);
  const periodB = periods?.find(p => p.id === periodBId);

  const labelA = periodA ? format(new Date(periodA.startDate), 'MMM yy', { locale: dateLocale }) : t('period_a');
  const labelB = periodB ? format(new Date(periodB.startDate), 'MMM yy', { locale: dateLocale }) : t('period_b');

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          {t('title')}
        </CardTitle>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] max-lg:text-xs font-bold uppercase text-muted-foreground italic">{t('base')}</span>
            <Select value={periodAId || ''} onValueChange={setPeriodAId}>
              <SelectTrigger className="w-[160px] h-8 text-xs font-medium bg-muted/30">
                <SelectValue placeholder={t('period_a_placeholder')}>
                  {periodA ? format(new Date(periodA.startDate), 'MMMM yyyy', { locale: dateLocale }) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periods?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {format(new Date(p.startDate), 'MMMM yyyy', { locale: dateLocale })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] max-lg:text-xs font-bold uppercase text-muted-foreground italic">{t('target')}</span>
            <Select value={periodBId || ''} onValueChange={setPeriodBId}>
              <SelectTrigger className="w-[160px] h-8 text-xs font-medium bg-primary/5 border-primary/20">
                <SelectValue placeholder={t('period_b_placeholder')}>
                  {periodB ? format(new Date(periodB.startDate), 'MMMM yyyy', { locale: dateLocale }) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periods?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {format(new Date(p.startDate), 'MMMM yyyy', { locale: dateLocale })} {p.id === periodId && t('current_suffix')}
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
            {t('select_two')}
          </div>
        ) : isLoading ? (
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row gap-4 p-3 bg-primary/5 rounded-lg border border-primary/10 text-[10px] max-lg:text-xs sm:text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="font-semibold text-muted-foreground uppercase">{t('period_a_label')}</span> {periodA ? `${format(new Date(periodA.startDate), 'dd/MM/yy')} - ${format(new Date(periodA.endDate), 'dd/MM/yy')}` : ''}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="font-semibold text-primary uppercase">{t('period_b_label')}</span> {periodB ? `${format(new Date(periodB.startDate), 'dd/MM/yy')} - ${format(new Date(periodB.endDate), 'dd/MM/yy')}` : ''}
              </div>
            </div>

            <ComparisonTable title={tr('expenses')} data={comparison?.expenses || []} labelA={labelA} labelB={labelB} isExpense />
            <ComparisonTable title={tr('income')} data={comparison?.income || []} labelA={labelA} labelB={labelB} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonTable({ title, data, labelA, labelB, isExpense }: { title: string, data: ComparisonPoint[], labelA: string, labelB: string, isExpense?: boolean }) {
  const t = useTranslations('Reporting.comparison');
  const tr = useTranslations('Reporting');
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
            <TableHead className="h-8 text-xs">{tr('category')}</TableHead>
            <TableHead className="h-8 text-right text-xs">{labelA}</TableHead>
            <TableHead className="h-8 text-right text-xs font-bold text-foreground underline decoration-primary/30 underline-offset-4">{labelB}</TableHead>
            <TableHead className="h-8 text-right text-xs">{t('gap')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.categoryId}>
              <TableCell className="py-2 text-sm font-medium">{item.name}</TableCell>
              <TableCell className="py-2 text-right text-xs text-muted-foreground">
                {formatCurrency(item.period1Real)}
              </TableCell>
              <TableCell className="py-2 text-right text-sm">
                {formatCurrency(item.period2Real)}
              </TableCell>
              <TableCell className="py-2 text-right">
                <ComparisonGap item={item} isExpense={isExpense} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// percentageDiff is the change of the amount: positive means more money (spent or received).
export function ComparisonGap({ item, isExpense }: { item: ComparisonPoint, isExpense?: boolean }) {
  const t = useTranslations('Reporting.comparison');
  const isNew = item.period1Real === '0' && item.period2Real !== '0';
  const isUp = isNew || item.percentageDiff > 0;
  const isNeutral = !isNew && item.percentageDiff === 0;
  // More spending is bad, more income is good
  const isGood = isExpense ? !isUp : isUp;

  return (
    <span
      data-testid="comparison-gap"
      className={cn(
        "text-xs font-bold inline-flex items-center justify-end gap-1",
        isNeutral ? "text-muted-foreground" : (isGood ? "text-emerald-600" : "text-rose-600")
      )}
    >
      {isNeutral ? <Minus className="w-3 h-3" /> : (isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
      {isNew ? t('new') : `${isUp ? '+' : ''}${item.percentageDiff}%`}
    </span>
  );
}
