'use client';

import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useBulkCreateTransactions } from '@/features/transactions/api/use-bulk-create-transactions';
import { usePeriodSwitchNotice } from '@/features/transactions/model/use-period-switch-notice';
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/shared/api/api-client';
import { useRouter } from '@/i18n/routing';
import { toCents, parseAmountToCents, centsToDecimalString } from '@/shared/lib/format';
import { ParsedTransaction, ImportStep, ImportMapping } from '@/features/transactions/model/import-types';
import { cleanDescription, decodeCsv, findHeaderRow, guessMapping } from '@/features/transactions/model/import-csv';
import { markImportRows, windowForRows, type ExistingTransaction, type ImportRowToCompare } from '@/features/transactions/model/import-duplicates';
import { parseImportDate } from '@/features/transactions/model/parse-import-date';
import { ImportUploadStep } from '@/features/transactions/ui/import/import-upload-step';
import { ImportMappingStep } from '@/features/transactions/ui/import/import-mapping-step';
import { ImportValidationStep } from '@/features/transactions/ui/import/import-validation-step';

// Back limit of the transactions list (`limit`).
const EXISTING_LIMIT = 5000;

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
  const { mutate: bulkCreate, isPending } = useBulkCreateTransactions();
  const notifyPeriodSwitch = usePeriodSwitchNotice();
  
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
  // The comparison with the account was made (false: not read, no line unchecked, no counts sent).
  const [compared, setCompared] = useState(false);
  const accountRef = useRef(activeAccountId);
  // One id per import run (analysis of a file) : an answer of an older run, or of another account, is dropped.
  const sessionRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Marks and rows belong to the account they were read for: changing account starts over.
  useEffect(() => {
    if (accountRef.current === activeAccountId) return;
    accountRef.current = activeAccountId;
    sessionRef.current += 1;
    setIsProcessing(false);
    setStep('upload');
    setParsedData([]);
    setCompared(false);
  }, [activeAccountId]);

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
    const session = ++sessionRef.current;
    const isCurrent = () => sessionRef.current === session;
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
      const descVal = cleanDescription(rowArr[descIdx] ?? '');
      
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
        description: descVal,
        amount: cents === null ? '' : centsToDecimalString(cents),
        invalidReason,
        categoryId: null,
        predicted: false,
      });
    }

    // Rows already in the account are unchecked by default; the account read is the imported one only.
    const accountId = activeAccountId;
    let marked = mappedData;
    let didCompare = false;
    if (accountId) {
      const toCompare: ImportRowToCompare[] = mappedData.map((r) => ({
        id: r.id,
        date: r.date,
        description: r.description,
        amount: r.invalidReason ? '' : toCents(r.amount),
        invalid: !!r.invalidReason,
      }));
      const window = windowForRows(toCompare);
      if (window) {
        try {
          const { data } = await apiClient.get(`/${accountId}/transactions`, {
            params: { ...window, limit: EXISTING_LIMIT },
          });
          const existing: ExistingTransaction[] = data.data;
          // A truncated read would uncheck on an incomplete base: treated as a failure.
          if (!Array.isArray(existing) || data.meta.total > existing.length) throw new Error('Existing transactions truncated');
          const marks = markImportRows(toCompare, existing);
          marked = mappedData.map((r) => {
            const m = marks[r.id];
            return m ? { ...r, ...m, excluded: !!m.duplicateOf } : r;
          });
          didCompare = true;
        } catch (error) {
          console.error('Existing transactions read failed', error);
          if (isCurrent()) toast.warning(t('existing_error'));
        }
      }
    }
    // The account changed on screen while reading: this answer is for another account.
    if (!isCurrent() || accountRef.current !== accountId) return;

    setCompared(didCompare);
    setParsedData(marked);
    setStep('validation');
    
    if (activeAccountId && marked.some(r => !r.invalidReason)) {
      toast.info(t('analyzing_categories'));
      const updatedData = [...marked];
      let predictionFailed = false;
      // Invalid rows are never predicted; the others go by chunks, one request per chunk.
      const validIndexes = updatedData.flatMap((row, i) => (row.invalidReason ? [] : [i]));
      for (let start = 0; start < validIndexes.length; start += PREDICTION_CHUNK_SIZE) {
        const chunk = validIndexes.slice(start, start + PREDICTION_CHUNK_SIZE);
        try {
          const { data } = await apiClient.post(`/${activeAccountId}/transactions/predict-categories`, {
            descriptions: chunk.map((i) => updatedData[i].description),
          });
          const predictions: { categoryId: string | null }[] = data.predictions ?? [];
          // Answer of an older run or of another account: ignored.
          if (!isCurrent()) return;
          // Applied by id on the current rows: a box checked or a category chosen meanwhile is kept.
          const predicted = new Map<string, string>();
          chunk.forEach((rowIndex, k) => {
            const categoryId = predictions[k]?.categoryId;
            if (categoryId) predicted.set(updatedData[rowIndex].id, categoryId);
          });
          setParsedData(prev => prev.map(row => {
            const categoryId = predicted.get(row.id);
            return categoryId && !row.categoryId ? { ...row, categoryId, predicted: true } : row;
          }));
        } catch (error) {
          // The import stays usable without predicted categories, but the failure is not silent.
          if (!isCurrent()) return;
          console.error('Category prediction failed', error);
          predictionFailed = true;
        }
      }
      if (predictionFailed && isCurrent()) toast.warning(t('prediction_error'));
    }
    if (isCurrent()) setIsProcessing(false);
  };

  const invalidCount = parsedData.filter(item => item.invalidReason).length;
  const validCount = parsedData.length - invalidCount;
  // Only checked, readable rows are sent.
  const sentRows = parsedData.filter(item => !item.invalidReason && !item.excluded);
  const sentCount = sentRows.length;
  // Exact duplicates unchecked by default vs readable lines unchecked by hand (not duplicates, or comparison failed).
  const setAsideCount = parsedData.filter(item => !item.invalidReason && item.excluded && item.duplicateOf).length;
  const unselectedCount = validCount - sentCount - setAsideCount;

  const handleImport = () => {
    if (!activeAccountId || sentCount === 0) return;

    const payload = sentRows.map(item => ({
      date: item.date,
      description: item.description,
      amount: toCents(item.amount),
      categoryId: item.categoryId || null,
      reconciled: true,
    }));

    bulkCreate({
      accountId: activeAccountId,
      transactions: payload,
      importStats: compared
        ? {
            excluded: parsedData.filter(item => item.duplicateOf).length,
            rechecked: parsedData.filter(item => item.duplicateOf && !item.excluded).length,
            closeFlagged: parsedData.filter(item => item.nearOf).length,
          }
        : undefined,
    }, {
      onSuccess: (result) => {
        notifyPeriodSwitch(result);
        toast.success(
          invalidCount > 0 || setAsideCount > 0 || unselectedCount > 0
            ? t('success_with_skipped', { imported: sentCount, skipped: invalidCount, excluded: setAsideCount, unselected: unselectedCount })
            : t('success', { imported: sentCount })
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
            <p className="text-muted-foreground">
              {step === 'upload' && t('subtitle_upload')}
              {step === 'mapping' && t('subtitle_mapping')}
              {step === 'validation' && t('subtitle_validation', { count: parsedData.length })}
            </p>
          </div>
        </div>
        {step === 'validation' && (
          <Button onClick={handleImport} disabled={isPending || sentCount === 0} size="lg" className="gap-2">
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
