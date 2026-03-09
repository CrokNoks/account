'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
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
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useBulkCreateTransactions } from '../api/use-bulk-create-transactions';
import { Upload, FileUp, Loader2, Sparkles, X, ArrowRight, Columns } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/shared/api/api-client';

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  categoryId: string | null;
  predicted?: boolean;
}

type Step = 'upload' | 'mapping' | 'validation';

export function ImportCsvDrawer() {
  const { activeAccountId } = useAccountStore();
  const { data: categories } = useCategories(activeAccountId);
  const { data: periods } = usePeriods(activeAccountId);
  const { mutate: bulkCreate, isPending } = useBulkCreateTransactions();
  
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  
  // Data states
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  
  // Mapping state
  const [mapping, setMapping] = useState({
    date: '',
    description: '',
    amount: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePeriod = periods?.find(p => p.isActive);

  const resetState = () => {
    setStep('upload');
    setCsvHeaders([]);
    setRawRows([]);
    setParsedData([]);
    setMapping({ date: '', description: '', amount: '' });
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const data = results.data as any[];
        
        setCsvHeaders(headers);
        setRawRows(data);
        
        // Try to guess mapping
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

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const dateVal = row[mapping.date];
      const descVal = row[mapping.description];
      const amountVal = row[mapping.amount];

      if (!dateVal || !descVal || !amountVal) continue;

      // Clean amount
      const cleanAmount = amountVal.toString().replace(/[^\d.,-]/g, '').replace(',', '.');
      
      // Format date
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
    
    // Run predictions
    if (activeAccountId && mappedData.length > 0) {
      toast.info(`Analyzing ${mappedData.length} transactions...`);
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

  const handleCategoryChange = (id: string, categoryId: string) => {
    setParsedData(prev => prev.map(item => 
      item.id === id ? { ...item, categoryId: categoryId === 'none' ? null : categoryId, predicted: false } : item
    ));
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
        setOpen(false);
        resetState();
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) resetState();
    }}>
      <SheetTrigger render={
        <Button variant="outline" className="gap-2">
          <FileUp className="w-4 h-4" />
          Import CSV
        </Button>
      } />
      <SheetContent side="right" className="w-[800px] sm:w-[950px] flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            <SheetTitle>
              {step === 'upload' && "Upload CSV"}
              {step === 'mapping' && "Map Columns"}
              {step === 'validation' && "Validate Transactions"}
            </SheetTitle>
          </div>
          <SheetDescription>
            {step === 'upload' && "Upload a CSV file from your bank."}
            {step === 'mapping' && "Tell us which column is which."}
            {step === 'validation' && "Review and correct predicted categories before final import."}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 bg-muted/10 text-center h-64">
              <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="mb-4">
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
                Select CSV File
              </Button>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-8">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2"><Columns className="w-4 h-4" /> Date</label>
                  <Select value={mapping.date} onValueChange={(v) => setMapping({...mapping, date: v})}>
                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2"><Columns className="w-4 h-4" /> Description</label>
                  <Select value={mapping.description} onValueChange={(v) => setMapping({...mapping, description: v})}>
                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2"><Columns className="w-4 h-4" /> Amount</label>
                  <Select value={mapping.amount} onValueChange={(v) => setMapping({...mapping, amount: v})}>
                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead colSpan={csvHeaders.length} className="bg-muted/50 text-center text-[10px] uppercase">CSV Preview (First 3 rows)</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rawRows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {csvHeaders.map(h => (
                          <TableCell key={h} className={`text-[10px] truncate max-w-[150px] ${[mapping.date, mapping.description, mapping.amount].includes(h) ? 'bg-primary/5 font-bold' : 'opacity-50'}`}>
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
            <div className="border rounded-md">
              <Table className="table-fixed w-full text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead className="w-[200px]">Description</TableHead>
                    <TableHead className="w-[100px] text-right">Amount</TableHead>
                    <TableHead className="w-[250px]">Category</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium whitespace-nowrap">{row.date}</TableCell>
                      <TableCell className="truncate" title={row.description}>{row.description}</TableCell>
                      <TableCell className={`text-right font-bold whitespace-nowrap ${parseFloat(row.amount) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {row.amount} €
                      </TableCell>
                      <TableCell>
                        <Select value={row.categoryId || 'none'} onValueChange={(v) => handleCategoryChange(row.id, v)}>
                          <SelectTrigger className="h-8 text-[10px] relative">
                            {row.predicted && <Sparkles className="w-3 h-3 text-yellow-500 absolute -left-1 -top-1" />}
                            <SelectValue>
                              {row.categoryId ? (
                                <div className="flex items-center gap-2 truncate">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categories?.find(c => c.id === row.categoryId)?.color }} />
                                  <span className="truncate">{categories?.find(c => c.id === row.categoryId)?.name}</span>
                                </div>
                              ) : "Uncategorized"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Uncategorized</SelectItem>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <div className="flex items-center gap-2 text-[10px]">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                  {cat.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
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
        </div>

        <SheetFooter className="p-6 border-t bg-muted/20 flex-row gap-3 justify-end">
          {step === 'mapping' && (
            <Button onClick={processMapping} disabled={!mapping.date || !mapping.description || !mapping.amount || isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Analyze Transactions
            </Button>
          )}
          {step === 'validation' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>Back to Mapping</Button>
              <Button onClick={handleImport} disabled={isPending || parsedData.length === 0}>
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Import {parsedData.length} Transactions
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
