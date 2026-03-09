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
import { useCategories, Category } from '@/features/categories/api/use-categories';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useBulkCreateTransactions } from '../api/use-bulk-create-transactions';
import { Upload, FileUp, Loader2, Sparkles, X } from 'lucide-react';
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

export function ImportCsvDrawer() {
  const { activeAccountId } = useAccountStore();
  const { data: categories } = useCategories(activeAccountId);
  const { data: periods } = usePeriods(activeAccountId);
  const { mutate: bulkCreate, isPending } = useBulkCreateTransactions();
  
  const [open, setOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePeriod = periods?.find(p => p.isActive);

  const resetState = () => {
    setParsedData([]);
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
      complete: async (results) => {
        const rows = results.data as any[];
        
        // Basic mapping logic (adjust based on expected CSV format)
        // Here we assume standard generic column names, or simple positional
        // For a robust app, you'd add a mapping step. We'll do a simple guess here.
        const mappedData: ParsedTransaction[] = [];
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          // Try to guess columns
          const date = row.Date || row.date || row.DateOp || Object.values(row)[0] as string;
          const description = row.Description || row.Libelle || row.label || Object.values(row)[1] as string;
          const amountStr = row.Amount || row.Montant || row.amount || Object.values(row)[2] as string;
          
          if (!date || !description || !amountStr) continue;
          
          // Clean amount string (e.g. " - 36,30 €" -> "-36.30")
          const cleanAmount = amountStr.replace(/[^\d.,-]/g, '').replace(',', '.');
          // Format date (assume DD/MM/YYYY or YYYY-MM-DD for now)
          let isoDate = new Date().toISOString().split('T')[0];
          try {
             if (date.includes('/')) {
                 const [d, m, y] = date.split('/');
                 isoDate = `${y.length === 2 ? '20'+y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
             } else {
                 isoDate = new Date(date).toISOString().split('T')[0];
             }
          } catch(e) {}

          mappedData.push({
            id: `row-${i}`,
            date: isoDate,
            description,
            amount: cleanAmount,
            categoryId: null,
            predicted: false,
          });
        }

        // Run prediction batch (simple iteration for now, but could be Promise.all)
        // To avoid hammering the API, we'll process them in small batches or sequence if many
        setParsedData(mappedData); // Show them immediately while predicting
        
        if (activeAccountId && mappedData.length > 0) {
            toast.info(`Analyzing ${mappedData.length} transactions for categories...`);
            const updatedData = [...mappedData];
            
            // Fire and forget predictions to update UI progressively
            for (let i = 0; i < updatedData.length; i++) {
                try {
                    const { data } = await apiClient.get(`/${activeAccountId}/transactions/predict-category`, {
                        params: { description: updatedData[i].description }
                    });
                    if (data.categoryId) {
                        updatedData[i].categoryId = data.categoryId;
                        updatedData[i].predicted = true;
                        // Trigger re-render for this update
                        setParsedData([...updatedData]);
                    }
                } catch(e) {
                    // ignore prediction errors
                }
            }
        }
        
        setIsProcessing(false);
      },
      error: () => {
        toast.error("Failed to parse CSV file");
        setIsProcessing(false);
      }
    });
  };

  const handleCategoryChange = (id: string, categoryId: string) => {
    setParsedData(prev => prev.map(item => 
      item.id === id ? { ...item, categoryId, predicted: false } : item
    ));
  };

  const handleRemoveRow = (id: string) => {
    setParsedData(prev => prev.filter(item => item.id !== id));
  };

  const handleImport = () => {
    if (!activeAccountId || parsedData.length === 0) return;

    const payload = parsedData.map(item => ({
      date: item.date,
      description: item.description,
      amount: Math.round(parseFloat(item.amount) * 100).toString(),
      categoryId: item.categoryId || null,
      periodId: activePeriod?.id || null, // Auto-assign to active period
      reconciled: true, // Imported are usually cleared
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
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileUp className="w-4 h-4" />
          Import CSV
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[800px] sm:w-[900px] flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            <SheetTitle>Import Transactions</SheetTitle>
          </div>
          <SheetDescription>
            Upload a CSV file from your bank. We will try to predict categories automatically.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {parsedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 bg-muted/10 text-center">
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <Button 
                variant="secondary" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="mb-4"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
                {isProcessing ? "Processing..." : "Select CSV File"}
              </Button>
              <p className="text-sm text-muted-foreground max-w-[300px]">
                Ensure your CSV has Date, Description, and Amount columns.
              </p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table className="table-fixed w-full">
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
                        <Select value={row.categoryId || ''} onValueChange={(v) => handleCategoryChange(row.id, v)}>
                          <SelectTrigger className="h-8 text-xs relative">
                            {row.predicted && <Sparkles className="w-3 h-3 text-yellow-500 absolute -left-1 -top-1" />}
                            <SelectValue placeholder="Select category">
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
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                  {cat.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleRemoveRow(row.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
          <Button variant="outline" onClick={() => resetState()} disabled={isPending || parsedData.length === 0}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isPending || parsedData.length === 0}>
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Import {parsedData.length} Transactions
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
