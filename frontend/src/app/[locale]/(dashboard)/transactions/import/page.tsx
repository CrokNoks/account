'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useBulkCreateTransactions } from '@/features/transactions/api/use-bulk-create-transactions';
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/shared/api/api-client';
import { useRouter } from '@/i18n/routing';
import { toCents } from '@/shared/lib/format';
import { ParsedTransaction, ImportStep, ImportMapping } from '@/features/transactions/model/import-types';
import { ImportUploadStep } from '@/features/transactions/ui/import/import-upload-step';
import { ImportMappingStep } from '@/features/transactions/ui/import/import-mapping-step';
import { ImportValidationStep } from '@/features/transactions/ui/import/import-validation-step';

export default function ImportTransactionsPage() {
  const router = useRouter();
  const { activeAccountId } = useAccountStore();
  const { data: categories } = useCategories(activeAccountId);
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

  const parseFile = (file: File) => {
    setIsProcessing(true);
    
    Papa.parse(file, {
      header: false,
      delimiter: delimiter,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as string[][];
        setRawRows(data);
        
        const headers = data[0] || [];
        setCsvHeaders(headers);
        
        // Guess mapping
        const guess = {
          date: headers.find(h => /date/i.test(h)) || headers[0] || '',
          description: headers.find(h => /libelle|description|label/i.test(h)) || headers[1] || '',
          amount: headers.find(h => /montant|amount/i.test(h)) || headers[2] || '',
          debit: headers.find(h => /debit/i.test(h)) || '',
          credit: headers.find(h => /credit/i.test(h)) || ''
        };
        setMapping(guess);
        setStep('mapping');
        setIsProcessing(false);
      },
      error: () => {
        toast.error("Failed to parse CSV file");
        setIsProcessing(false);
      }
    });
  };

  const handleHeaderRowChange = (index: number) => {
    const idx = Math.max(0, Math.min(index, rawRows.length - 1));
    setHeaderRowIndex(idx);
    const newHeaders = rawRows[idx] || [];
    setCsvHeaders(newHeaders);
    
    setMapping({
      date: newHeaders.find(h => /date/i.test(h)) || newHeaders[0] || '',
      description: newHeaders.find(h => /libelle|description|label/i.test(h)) || newHeaders[1] || '',
      amount: newHeaders.find(h => /montant|amount/i.test(h)) || newHeaders[2] || '',
      debit: newHeaders.find(h => /debit/i.test(h)) || '',
      credit: newHeaders.find(h => /credit/i.test(h)) || ''
    });
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
      
      let finalAmount = "0";
      if (amountMode === 'single') {
        finalAmount = rowArr[amountIdx] || "0";
      } else {
        const d = rowArr[debitIdx] || "0";
        const c = rowArr[creditIdx] || "0";
        const dv = parseFloat(d.toString().replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
        const cv = parseFloat(c.toString().replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
        finalAmount = (cv - Math.abs(dv)).toString();
      }

      if (!dateVal || !descVal) continue;

      const cleanAmount = finalAmount.toString().replace(/[^\d.,-]/g, '').replace(',', '.');
      
      let isoDate = new Date().toISOString().split('T')[0];
      try {
        if (dateVal.includes('/')) {
          const [d, m, y] = dateVal.split('/');
          isoDate = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else {
          isoDate = new Date(dateVal).toISOString().split('T')[0];
        }
      } catch {
        // Ignore date parsing error
      }

      mappedData.push({
        id: `row-${i}`,
        date: isoDate,
        description: descVal.toString(),
        amount: cleanAmount,
        categoryId: null,
        predicted: false,
      });
    }

    setParsedData(mappedData);
    setStep('validation');
    
    if (activeAccountId && mappedData.length > 0) {
      toast.info(`Analyse des catégories en cours...`);
      const updatedData = [...mappedData];
      for (let i = 0; i < updatedData.length; i++) {
        try {
          const { data } = await apiClient.get(`/${activeAccountId}/transactions/predict-category`, {
            params: { description: updatedData[i].description }
          });
          if (data.categoryId) {
            updatedData[i].categoryId = data.categoryId;
            updatedData[i].predicted = true;
            setParsedData([...updatedData]);
          }
        } catch {
          // Ignore prediction error
        }
      }
    }
    setIsProcessing(false);
  };

  const handleImport = () => {
    if (!activeAccountId || parsedData.length === 0) return;

    const payload = parsedData.map(item => ({
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
            <h2 className="text-3xl font-bold tracking-tight">Import Transactions</h2>
            <p className="text-muted-foreground">
              {step === 'upload' && "Chargez votre relevé bancaire (CSV)"}
              {step === 'mapping' && "Configurez la ligne d&apos;en-tête et le mapping des colonnes"}
              {step === 'validation' && `Validez les ${parsedData.length} transactions`}
            </p>
          </div>
        </div>
        {step === 'validation' && (
          <Button onClick={handleImport} disabled={isPending || parsedData.length === 0} size="lg" className="gap-2">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmer l&apos;import
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
                Analyser les données
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
              categories={categories}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
