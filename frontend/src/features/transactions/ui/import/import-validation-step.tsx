'use client';

import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { formatCurrency, toCents } from '@/shared/lib/format';
import { formatDateOnly } from '@/shared/lib/date-only';
import { ParsedTransaction } from '../../model/import-types';
import { CategorySelector } from '@/features/categories/ui/category-selector';

interface ImportValidationStepProps {
  parsedData: ParsedTransaction[];
  setParsedData: React.Dispatch<React.SetStateAction<ParsedTransaction[]>>;
  accountId: string | null;
}

export function ImportValidationStep({
  parsedData,
  setParsedData,
  accountId
}: ImportValidationStepProps) {
  const t = useTranslations('Import.validation');
  const locale = useLocale();
  const invalidCount = parsedData.filter((row) => row.invalidReason).length;

  return (
    <div className="p-0">
      {invalidCount > 0 && (
        <div role="alert" className="px-8 py-3 text-sm font-medium text-destructive bg-destructive/10 border-b">
          {t('skipped_banner', { count: invalidCount })}
        </div>
      )}
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-[120px] pl-8 text-xs">{t('date')}</TableHead>
            <TableHead className="min-w-[250px] text-xs">{t('description')}</TableHead>
            <TableHead className="w-[150px] text-right text-xs">{t('amount')}</TableHead>
            <TableHead className="w-[300px] text-xs">{t('category')}</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parsedData.map((row) => (
            <TableRow key={row.id} className={row.invalidReason ? 'bg-destructive/10' : undefined} data-invalid={row.invalidReason ? 'true' : undefined}>
              <TableCell className="pl-8 font-medium text-xs">
                {formatDateOnly(row.date, locale)}
                {row.invalidReason === 'date' && <span className="block text-destructive">{t('unreadable_date')}</span>}
              </TableCell>
              <TableCell className="truncate text-xs" title={row.description}>{row.description}</TableCell>
              <TableCell className={`text-right font-bold text-xs ${parseFloat(row.amount) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                {row.invalidReason === 'amount' ? (
                  <span className="text-destructive">{t('unreadable_amount')}</span>
                ) : (
                  formatCurrency(toCents(row.amount))
                )}
              </TableCell>
              <TableCell>
                <CategorySelector
                  accountId={accountId}
                  disabled={!!row.invalidReason}
                  value={row.categoryId || ''}
                  className="h-9 text-xs"
                  onChange={(id) => {
                    setParsedData(prev => prev.map(item => item.id === row.id ? { ...item, categoryId: id || null, predicted: false } : item));
                  }}
                />
              </TableCell>
              <TableCell className="pr-8">
                <Button variant="ghost" size="icon-sm" onClick={() => setParsedData(prev => prev.filter(p => p.id !== row.id))} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
