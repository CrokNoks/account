'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useBulkCreateTransactions } from '@/features/transactions/api/use-bulk-create-transactions';
import { Upload, FileUp, Loader2, Sparkles, X, ArrowRight, Columns, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/shared/api/api-client';
import { useRouter } from '@/i18n/routing';
import { formatCurrency } from '@/shared/lib/format';

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  categoryId: string | null;
  predicted?: boolean;
}

type Step = 'upload' | 'mapping' | 'validation';

export default function ImportTransactionsPage() {
  const router = useRouter();
  const { activeAccountId } = useAccountStore();
  const { data: categories } = useCategories(activeAccountId);
  const { data: periods } = usePeriods(activeAccountId);
  const { mutate: bulkCreate, isPending } = useBulkCreateTransactions();
  
  const [step, setStep] = useState<Step>('upload');
  
  // Data states
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  
  // Mapping state
  const [skipRows, setSkipRows] = useState(0);
  const [mapping, setMapping] = useState({
    date: '',
    description: '',
    amount: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePeriod = periods?.find(p => p.isActive);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setRawRows(results.data);
        
        // Guess mapping
        const guess = {
          date: headers.find(h => /date/i.test(h)) || headers[0] || '',
          description: headers.find(h => /libelle|description|label/i.test(h)) || headers[1] || '',
          amount: headers.find(h => /montant|amount/i.test(h)) || headers[2] || ''
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

  const processMapping = async () => {
    setIsProcessing(true);
    const mappedData: ParsedTransaction[] = [];
    const rowsToProcess = rawRows.slice(skipRows);

    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      const dateVal = row[mapping.date];
      const descVal = row[mapping.description];
      const amountVal = row[mapping.amount];

      if (!dateVal || !descVal || !amountVal) continue;

      const cleanAmount = amountVal.toString().replace(/[^\d.,-]/g, '').replace(',', '.');
      
      let isoDate = new Date().toISOString().split('T')[0];
      try {
        if (dateVal.includes('/')) {
          const [d, m, y] = dateVal.split('/');
          isoDate = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else {
          isoDate = new Date(dateVal).toISOString().split('T')[0];
        }
      } catch (e) {}

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
      toast.info(`Analyzing categories for ${mappedData.length} transactions...`);
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
        } catch (e) {}
      }
    }
    setIsProcessing(false);
  };

  const handleImport = () => {
    if (!activeAccountId || parsedData.length === 0) return;

    const payload = parsedData.map(item => ({
      date: item.date,
      description: item.description,
      amount: Math.round(parseFloat(item.amount) * 100).toString(),
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
              {step === 'upload' && "Upload your bank statement (CSV)"}
              {step === 'mapping' && "Configure column matching"}
              {step === 'validation' && `Validate ${parsedData.length} transactions`}
            </p>
          </div>
        </div>
        {step === 'validation' && (
          <Button onClick={handleImport} disabled={isPending || parsedData.length === 0} size="lg" className="gap-2">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirm Import
          </Button>
        )}
      </div>

      <Card className="min-h-[400px] flex flex-col">
        <CardHeader className="border-b bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1</div>
              <div className={`h-px w-8 bg-muted`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'mapping' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</div>
              <div className={`h-px w-8 bg-muted`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'validation' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3</div>
            </div>
            {step === 'mapping' && (
              <Button onClick={processMapping} disabled={!mapping.date || !mapping.description || !mapping.amount || isProcessing} className="gap-2">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Analyze Data
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          {step === 'upload' && (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 h-full min-h-[400px]">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Drop your file here</h3>
                <p className="text-muted-foreground max-w-sm">Select the CSV export from your bank to start the import process.</p>
              </div>
              <Button size="lg" onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="px-8">
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
                Select CSV File
              </Button>
            </div>
          )}

          {step === 'mapping' && (
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-muted/20 p-6 rounded-xl border">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date Column</label>
                  <Select value={mapping.date} onValueChange={(v) => setMapping({...mapping, date: v})}>
                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                    <SelectContent>{csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description Column</label>
                  <Select value={mapping.description} onValueChange={(v) => setMapping({...mapping, description: v})}>
                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                    <SelectContent>{csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount Column</label>
                  <Select value={mapping.amount} onValueChange={(v) => setMapping({...mapping, amount: v})}>
                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                    <SelectContent>{csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Skip Header Rows</label>
                  <Input type="number" min="0" value={skipRows} onChange={(e) => setSkipRows(parseInt(e.target.value, 10) || 0)} />
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b">CSV Preview</div>
                <Table>
                  <TableBody>
                    {rawRows.slice(skipRows, skipRows + 5).map((row, i) => (
                      <TableRow key={i}>
                        {csvHeaders.map(h => (
                          <TableCell key={h} className={`text-[11px] truncate max-w-[200px] ${[mapping.date, mapping.description, mapping.amount].includes(h) ? 'bg-primary/5 font-semibold text-primary' : 'opacity-40'}`}>
                            {row[h]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {step === 'validation' && (
            <div className="p-0">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[120px] pl-6 text-xs">Date</TableHead>
                    <TableHead className="min-w-[250px] text-xs">Description</TableHead>
                    <TableHead className="w-[150px] text-right text-xs">Amount</TableHead>
                    <TableHead className="w-[300px] text-xs">Category (Auto-predicted ✨)</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-6 font-medium text-xs">{row.date}</TableCell>
                      <TableCell className="truncate text-xs" title={row.description}>{row.description}</TableCell>
                      <TableCell className={`text-right font-bold text-xs ${parseFloat(row.amount) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatCurrency((Math.round(parseFloat(row.amount) * 100)).toString())}
                      </TableCell>
                      <TableCell>
                        <Select value={row.categoryId || 'none'} onValueChange={(v) => {
                          setParsedData(prev => prev.map(item => item.id === row.id ? { ...item, categoryId: v === 'none' ? null : v, predicted: false } : item));
                        }}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue>
                              {row.categoryId ? (
                                <div className="flex items-center gap-2 truncate">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categories?.find(c => c.id === row.categoryId)?.color }} />
                                  <span className="truncate">{categories?.find(c => c.id === row.categoryId)?.name}</span>
                                </div>
                              ) : <span className="text-muted-foreground italic">No category</span>}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Uncategorized</SelectItem>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                  {cat.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="pr-6">
                        <Button variant="ghost" size="icon-sm" onClick={() => setParsedData(prev => prev.filter(p => p.id !== row.id))} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
