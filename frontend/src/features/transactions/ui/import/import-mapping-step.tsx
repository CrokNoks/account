'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableRow 
} from "@/components/ui/table";
import { useTranslations } from 'next-intl';
import { ImportMapping } from '../../model/import-types';

interface ImportMappingStepProps {
  amountMode: 'single' | 'separate';
  setAmountMode: (v: 'single' | 'separate') => void;
  headerRowIndex: number;
  handleHeaderRowChange: (index: number) => void;
  mapping: ImportMapping;
  setMapping: (v: ImportMapping) => void;
  csvHeaders: string[];
  rawRows: string[][];
}

export function ImportMappingStep({
  amountMode,
  setAmountMode,
  headerRowIndex,
  handleHeaderRowChange,
  mapping,
  setMapping,
  csvHeaders,
  rawRows
}: ImportMappingStepProps) {
  const t = useTranslations('Import.mapping');
  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border w-fit">
          <Button 
            variant={amountMode === 'single' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setAmountMode('single')}
            className="h-8 text-xs px-4"
          >
            {t('single_amount')}
          </Button>
          <Button 
            variant={amountMode === 'separate' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setAmountMode('separate')}
            className="h-8 text-xs px-4"
          >
            {t('debit_credit')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-muted/20 p-6 rounded-xl border">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('header_row')}</label>
            <Input type="number" min="0" value={headerRowIndex} onChange={(e) => handleHeaderRowChange(parseInt(e.target.value, 10) || 0)} className="h-10" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('date_column')}</label>
            <Select value={mapping.date || ''} onValueChange={(v) => setMapping({...mapping, date: v || ''})}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={t('date')}>
                  {mapping.date || t('date')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>{csvHeaders.map((h, i) => <SelectItem key={i} value={h}>{h || t('column_n', { index: i })}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('description_column')}</label>
            <Select value={mapping.description || ''} onValueChange={(v) => setMapping({...mapping, description: v || ''})}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={t('description')}>
                  {mapping.description || t('description')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>{csvHeaders.map((h, i) => <SelectItem key={i} value={h}>{h || t('column_n', { index: i })}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          
          {amountMode === 'single' ? (
            <div className="space-y-2 md:col-span-2 text-primary">
              <label className="text-[10px] font-bold uppercase tracking-wider">{t('amount_column')}</label>
              <Select value={mapping.amount || ''} onValueChange={(v) => setMapping({...mapping, amount: v || ''})}>
                <SelectTrigger className="h-10 border-primary/30">
                  <SelectValue placeholder={t('amount')}>
                    {mapping.amount || t('amount')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>{csvHeaders.map((h, i) => <SelectItem key={i} value={h}>{h || t('column_n', { index: i })}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-red-500">
                <label className="text-[10px] font-bold uppercase tracking-wider">{t('debit_column')}</label>
                <Select value={mapping.debit || ''} onValueChange={(v) => setMapping({...mapping, debit: v || ''})}>
                  <SelectTrigger className="h-10 border-red-200">
                    <SelectValue placeholder={t('debit')}>
                      {mapping.debit || t('debit')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>{csvHeaders.map((h, i) => <SelectItem key={i} value={h}>{h || t('column_n', { index: i })}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 text-green-500">
                <label className="text-[10px] font-bold uppercase tracking-wider">{t('credit_column')}</label>
                <Select value={mapping.credit || ''} onValueChange={(v) => setMapping({...mapping, credit: v || ''})}>
                  <SelectTrigger className="h-10 border-green-200">
                    <SelectValue placeholder={t('credit')}>
                      {mapping.credit || t('credit')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>{csvHeaders.map((h, i) => <SelectItem key={i} value={h}>{h || t('column_n', { index: i })}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden shadow-sm">
        <div className="bg-muted/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b flex justify-between items-center">
          <span>{t('preview')}</span>
          <span className="text-[9px] font-normal text-muted-foreground">{t('active_columns')}</span>
        </div>
        <Table>
          <TableBody>
            {rawRows.slice(Math.max(0, headerRowIndex - 1), headerRowIndex + 6).map((rowArr, i) => {
              const actualIndex = Math.max(0, headerRowIndex - 1) + i;
              const isHeader = actualIndex === headerRowIndex;
              const activeCols = [mapping.date, mapping.description, amountMode === 'single' ? mapping.amount : null, mapping.debit, mapping.credit].filter(Boolean);
              return (
                <TableRow key={actualIndex} className={isHeader ? "bg-primary/5" : ""}>
                  <TableCell className="w-12 text-[9px] font-mono text-muted-foreground border-r bg-muted/5 text-center">{actualIndex}</TableCell>
                  {rowArr.map((cell, j) => {
                    const headerName = csvHeaders[j];
                    const isActive = activeCols.includes(headerName);
                    return (
                      <TableCell key={j} className={`text-[11px] truncate max-w-[200px] ${isActive && isHeader ? 'font-bold text-primary underline decoration-2' : isActive ? 'bg-primary/5 font-medium' : 'opacity-40'}`}>
                        {cell}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
