'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useBulkCreateTransactions } from '@/features/transactions/api/use-bulk-create-transactions';
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/shared/api/api-client';
import { useRouter } from '@/i18n/routing';
import { toCents, parseAmountToCents, centsToDecimalString } from '@/shared/lib/format';
import { ParsedTransaction, ImportStep, ImportMapping } from '@/features/transactions/model/import-types';
import { decodeCsv, findHeaderRow, guessMapping } from '@/features/transactions/model/import-csv';
import { parseImportDate } from '@/features/transactions/model/parse-import-date';
import { ImportUploadStep } from '@/features/transactions/ui/import/import-upload-step';
import { ImportMappingStep } from '@/features/transactions/ui/import/import-mapping-step';
import { ImportValidationStep } from '@/features/transactions/ui/import/import-validation-step';

// Must stay under the back limit of 1000 descriptions per request.
const PREDICTION_CHUNK_SIZE = 500;

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export default function ImportTransactionsPage() {
  const t = useTranslations('Import');
  const router = useRouter();
  const { activeAccountId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  const { mutate: bulkCreate, isPending } = useBulkCreateTransactions();
  
  const [step, setStep] = useState<ImportStep>('upload');
  
  // Data states
  const [delimiter, setDelimiter] = useState<',' | ';'>(';');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  
  // Mapping state
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [amountMode, setAmountMode] = useState<'single' | 'separate'>('single');
  const [mapping, setMapping] = useState<ImportMapping>({
    date: '',
    description: '',
    amount: '',
    debit: '',
    credit: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePeriod = periods?.find(p => p.isActive);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    parseFile(file);
  };

  const parseFile = async (file: File) => {
    setIsProcessing(true);

    let text: string;
    try {
      text = decodeCsv(await readAsArrayBuffer(file));
    } catch {
      toast.error(t('parse_error'));
      setIsProcessing(false);
      return;
    }

    Papa.parse<string[]>(text, {
      header: false,
      delimiter: delimiter,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as string[][];
        setRawRows(data);
        applyHeaderRow(data, findHeaderRow(data));
        setStep('mapping');
        setIsProcessing(false);
      },
      error: () => {
        toast.error(t('parse_error'));
        setIsProcessing(false);
      }
    });
  };

  // Header row chosen (detected or typed): columns and amount mode are guessed again.
  const applyHeaderRow = (rows: string[][], index: number) => {
    const headers = rows[index] || [];
    const guess = guessMapping(headers);
    setHeaderRowIndex(index);
    setCsvHeaders(headers);
    setMapping(guess.mapping);
    setAmountMode(guess.amountMode);
  };

  const handleHeaderRowChange = (index: number) => {
    applyHeaderRow(rawRows, Math.max(0, Math.min(index, rawRows.length - 1)));
  };

  const processMapping = async () => {
    setIsProcessing(true);
    const mappedData: ParsedTransaction[] = [];
    const dateIdx = csvHeaders.indexOf(mapping.date);
    const descIdx = csvHeaders.indexOf(mapping.description);
    const amountIdx = csvHeaders.indexOf(mapping.amount);
    const debitIdx = csvHeaders.indexOf(mapping.debit);
    const creditIdx = csvHeaders.indexOf(mapping.credit);

    const dataRows = rawRows.slice(headerRowIndex + 1);

    for (let i = 0; i < dataRows.length; i++) {
      const rowArr = dataRows[i];
      const dateVal = rowArr[dateIdx];
      const descVal = rowArr[descIdx];
      
      if (!dateVal || !descVal) continue;

      let cents: bigint | null;
      if (amountMode === 'single') {
        const raw = (rowArr[amountIdx] ?? '').toString();
        cents = raw.trim() === '' ? null : parseAmountToCents(raw);
      } else {
        const rawDebit = (rowArr[debitIdx] ?? '').toString();
        const rawCredit = (rowArr[creditIdx] ?? '').toString();
        const dv = rawDebit.trim() === '' ? BigInt(0) : parseAmountToCents(rawDebit);
        const cv = rawCredit.trim() === '' ? BigInt(0) : parseAmountToCents(rawCredit);
        // both cells empty or one unreadable: the line has no usable amount
        cents =
          dv === null || cv === null || (rawDebit.trim() === '' && rawCredit.trim() === '')
            ? null
            : cv - (dv < BigInt(0) ? -dv : dv);
      }

      const isoDate = parseImportDate(dateVal.toString());
      const invalidReason: ParsedTransaction['invalidReason'] =
        cents === null ? 'amount' : isoDate === null ? 'date' : undefined;

      mappedData.push({
        id: `row-${i}`,
        date: isoDate ?? dateVal.toString(),
        description: descVal.toString(),
        amount: cents === null ? '' : centsToDecimalString(cents),
        invalidReason,
        categoryId: null,
        predicted: false,
      });
    }

    setParsedData(mappedData);
    setStep('validation');
    
    if (activeAccountId && mappedData.some(r => !r.invalidReason)) {
      toast.info(t('analyzing_categories'));
      const updatedData = [...mappedData];
      // Invalid rows are never predicted; the others go by chunks, one request per chunk.
      const validIndexes = updatedData.flatMap((row, i) => (row.invalidReason ? [] : [i]));
      for (let start = 0; start < validIndexes.length; start += PREDICTION_CHUNK_SIZE) {
        const chunk = validIndexes.slice(start, start + PREDICTION_CHUNK_SIZE);
        try {
          const { data } = await apiClient.post(`/${activeAccountId}/transactions/predict-categories`, {
            descriptions: chunk.map((i) => updatedData[i].description),
          });
          const predictions: { categoryId: string | null }[] = data.predictions ?? [];
          chunk.forEach((rowIndex, k) => {
            const categoryId = predictions[k]?.categoryId;
            if (categoryId) {
              updatedData[rowIndex] = { ...updatedData[rowIndex], categoryId, predicted: true };
            }
          });
          setParsedData([...updatedData]);
        } catch {
          // Ignore prediction error
        }
      }
    }
    setIsProcessing(false);
  };

  const invalidCount = parsedData.filter(item => item.invalidReason).length;
  const validCount = parsedData.length - invalidCount;

  const handleImport = () => {
    if (!activeAccountId || validCount === 0) return;

    const payload = parsedData.filter(item => !item.invalidReason).map(item => ({
      date: item.date,
      description: item.description,
      amount: toCents(item.amount),
      categoryId: item.categoryId || null,
      periodId: activePeriod?.id || null,
      reconciled: true,
    }));

    bulkCreate({
      accountId: activeAccountId,
      transactions: payload,
    }, {
      onSuccess: () => {
        toast.success(
          invalidCount > 0
            ? t('success_with_skipped', { imported: validCount, skipped: invalidCount })
            : t('success', { imported: validCount })
        );
        router.push('/transactions');
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
            <p className="text-muted-foreground">
              {step === 'upload' && t('subtitle_upload')}
              {step === 'mapping' && t('subtitle_mapping')}
              {step === 'validation' && t('subtitle_validation', { count: parsedData.length })}
            </p>
          </div>
        </div>
        {step === 'validation' && (
          <Button onClick={handleImport} disabled={isPending || validCount === 0} size="lg" className="gap-2">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {t('confirm')}
          </Button>
        )}
      </div>

      <Card className="min-h-[400px] flex flex-col shadow-lg border-primary/10">
        <CardHeader className="border-b bg-muted/10 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'upload' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>1</div>
              <div className={`h-px w-8 bg-muted`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'mapping' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>2</div>
              <div className={`h-px w-8 bg-muted`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'validation' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>3</div>
            </div>
            {step === 'mapping' && (
              <Button onClick={processMapping} disabled={!mapping.date || !mapping.description || (amountMode === 'single' ? !mapping.amount : (!mapping.debit || !mapping.credit)) || isProcessing} className="gap-2 shadow-lg shadow-primary/20">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {t('analyze')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          {step === 'upload' && (
            <ImportUploadStep 
              delimiter={delimiter}
              setDelimiter={setDelimiter}
              onFileUpload={handleFileUpload}
              fileInputRef={fileInputRef}
              isProcessing={isProcessing}
            />
          )}

          {step === 'mapping' && (
            <ImportMappingStep 
              amountMode={amountMode}
              setAmountMode={setAmountMode}
              headerRowIndex={headerRowIndex}
              handleHeaderRowChange={handleHeaderRowChange}
              mapping={mapping}
              setMapping={setMapping}
              csvHeaders={csvHeaders}
              rawRows={rawRows}
            />
          )}

          {step === 'validation' && (
            <ImportValidationStep 
              parsedData={parsedData}
              setParsedData={setParsedData}
              accountId={activeAccountId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
