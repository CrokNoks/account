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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useBulkCreateTransactions } from '@/features/transactions/api/use-bulk-create-transactions';
import { Upload, FileUp, Loader2, X, ArrowRight, Columns, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/shared/api/api-client';
import { useRouter } from '@/i18n/routing';
import { formatCurrency, toCents } from '@/shared/lib/format';

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
  const [delimiter, setDelimiter] = useState<',' | ';'>(';');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  
  // Mapping state
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [amountMode, setAmountMode] = useState<'single' | 'separate'>('single');
  const [mapping, setMapping] = useState({
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
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 h-full min-h-[400px]">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              
              <div className="flex flex-col items-center gap-6 bg-muted/20 p-8 rounded-xl border max-w-md w-full shadow-sm">
                <div className="space-y-3 w-full text-left">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Columns className="w-3 h-3" /> Séparateur CSV
                  </label>
                  <Select value={delimiter} onValueChange={(v) => setDelimiter(v as ',' | ';')}>
                    <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Virgule ( , )</SelectItem>
                      <SelectItem value=";">Point-virgule ( ; )</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Sélectionnez votre fichier</h3>
                  <p className="text-muted-foreground text-sm">Le fichier CSV exporté par votre banque.</p>
                </div>
                
                <Button size="lg" onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20">
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
                  Choisir le fichier
                </Button>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="p-8 space-y-8">
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border w-fit">
                  <Button 
                    variant={amountMode === 'single' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setAmountMode('single')}
                    className="h-8 text-xs px-4"
                  >
                    Colonne Montant unique
                  </Button>
                  <Button 
                    variant={amountMode === 'separate' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setAmountMode('separate')}
                    className="h-8 text-xs px-4"
                  >
                    Débit / Crédit séparés
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-muted/20 p-6 rounded-xl border">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ligne d&apos;en-tête</label>
                    <Input type="number" min="0" value={headerRowIndex} onChange={(e) => handleHeaderRowChange(parseInt(e.target.value, 10) || 0)} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Colonne Date</label>
                    <Select value={mapping.date || ''} onValueChange={(v) => setMapping({...mapping, date: v || ''})}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Date" /></SelectTrigger>
                      <SelectContent>{csvHeaders.map((h, i) => <SelectItem key={i} value={h}>{h || `Col ${i}`}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Colonne Description</label>
                    <Select value={mapping.description || ''} onValueChange={(v) => setMapping({...mapping, description: v || ''})}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Description" /></SelectTrigger>
                      <SelectContent>{csvHeaders.map((h, i) => <SelectItem key={i} value={h}>{h || `Col ${i}`}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  {amountMode === 'single' ? (
                    <div className="space-y-2 md:col-span-2 text-primary">
                      <label className="text-[10px] font-bold uppercase tracking-wider">Colonne Montant</label>
                      <Select value={mapping.amount || ''} onValueChange={(v) => setMapping({...mapping, amount: v || ''})}>
                        <SelectTrigger className="h-10 border-primary/30"><SelectValue placeholder="Montant" /></SelectTrigger>
                        <SelectContent>{csvHeaders.map((h, i) => <SelectItem key={i} value={h}>{h || `Col ${i}`}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 text-red-500">
                        <label className="text-[10px] font-bold uppercase tracking-wider">Colonne Débit</label>
                        <Select value={mapping.debit || ''} onValueChange={(v) => setMapping({...mapping, debit: v || ''})}>
                          <SelectTrigger className="h-10 border-red-200"><SelectValue placeholder="Débit" /></SelectTrigger>
                          <SelectContent>{csvHeaders.map((h, i) => <SelectItem key={i} value={h}>{h || `Col ${i}`}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 text-green-500">
                        <label className="text-[10px] font-bold uppercase tracking-wider">Colonne Crédit</label>
                        <Select value={mapping.credit || ''} onValueChange={(v) => setMapping({...mapping, credit: v || ''})}>
                          <SelectTrigger className="h-10 border-green-200"><SelectValue placeholder="Crédit" /></SelectTrigger>
                          <SelectContent>{csvHeaders.map((h, i) => <SelectItem key={i} value={h}>{h || `Col ${i}`}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden shadow-sm">
                <div className="bg-muted/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b flex justify-between items-center">
                  <span>Aperçu du CSV</span>
                  <span className="text-[9px] font-normal text-muted-foreground">Colonnes actives surlignées</span>
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
          )}

          {step === 'validation' && (
            <div className="p-0">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[120px] pl-8 text-xs">Date</TableHead>
                    <TableHead className="min-w-[250px] text-xs">Description</TableHead>
                    <TableHead className="w-[150px] text-right text-xs">Montant</TableHead>
                    <TableHead className="w-[300px] text-xs">Catégorie</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-8 font-medium text-xs">{row.date}</TableCell>
                      <TableCell className="truncate text-xs" title={row.description}>{row.description}</TableCell>
                      <TableCell className={`text-right font-bold text-xs ${parseFloat(row.amount) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatCurrency(toCents(row.amount))}
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
                              ) : <span className="text-muted-foreground italic">Pas de catégorie</span>}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non catégorisé</SelectItem>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
