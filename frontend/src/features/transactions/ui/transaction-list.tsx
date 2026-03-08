'use client';

import { useState, useEffect } from 'react';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useTransactions, Transaction } from '../api/use-transactions';
import { useUpdateTransaction } from '../api/use-update-transaction';
import { useDeleteTransaction } from '../api/use-delete-transaction';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useCategories } from '@/features/categories/api/use-categories';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { formatCurrency } from '@/shared/lib/format';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Circle, Trash2, Pencil } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function TransactionList({ periodId }: { periodId?: string }) {
  const t = useTranslations('Transactions');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  const { data: categories } = useCategories(activeAccountId);
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();
  const { mutate: deleteTransaction, isPending: isDeleting } = useDeleteTransaction();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | 'all'>(periodId || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reconciled' | 'not_reconciled'>('all');
  
  const filterPeriodId = selectedPeriodId === 'all' ? null : selectedPeriodId;
  const { data: allTransactions, isLoading } = useTransactions(activeAccountId, filterPeriodId);

  // Apply status filter client-side
  const transactions = allTransactions?.filter(t => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'reconciled') return t.reconciled;
    if (statusFilter === 'not_reconciled') return !t.reconciled;
    return true;
  });

  // Sync internal state if prop changes
  useEffect(() => {
    if (periodId) {
      setSelectedPeriodId(periodId);
    }
  }, [periodId]);

  const toggleReconciliation = (transactionId: string, currentStatus: boolean) => {
    if (!activeAccountId) return;
    updateTransaction({
      accountId: activeAccountId,
      id: transactionId,
      data: { reconciled: !currentStatus }
    }, {
      onSuccess: () => toast.success(t('toggled'))
    });
  };

  const handleDelete = (id: string, description: string) => {
    if (!activeAccountId || !confirm(t('delete_confirm'))) return;
    deleteTransaction({ accountId: activeAccountId, id }, {
      onSuccess: () => toast.success(t('deleted'))
    });
  };

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue>
              {statusFilter === 'all' ? t('status_all') : statusFilter === 'reconciled' ? t('status_reconciled') : t('status_not_reconciled')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('status_all')}</SelectItem>
            <SelectItem value="reconciled">{t('status_reconciled')}</SelectItem>
            <SelectItem value="not_reconciled">{t('status_not_reconciled')}</SelectItem>
          </SelectContent>
        </Select>

        {!periodId && (
          <Select value={selectedPeriodId} onValueChange={(v) => setSelectedPeriodId(v || 'all')}>
            <SelectTrigger className="w-[250px]">
              <SelectValue>
                {selectedPeriodId === 'all' 
                  ? 'Toutes les périodes' 
                  : (function() {
                      const p = periods?.find(p => p.id === selectedPeriodId);
                      return p ? `${format(new Date(p.startDate), 'dd/MM/yy')} - ${format(new Date(p.endDate), 'dd/MM/yy')}` : 'Filter by period';
                    })()
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les périodes</SelectItem>
              {periods?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {format(new Date(p.startDate), 'dd/MM/yy')} - {format(new Date(p.endDate), 'dd/MM/yy')} {p.isActive && "(Active)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
      )}
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-center">Status</TableHead>
              <TableHead className="w-[120px]">{t('fields.date')}</TableHead>
              <TableHead className="min-w-[200px]">{t('fields.description')}</TableHead>
              <TableHead className="w-[150px]">{t('fields.category')}</TableHead>
              <TableHead className="w-[120px] text-right">{t('fields.amount')}</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">{t('empty')}</TableCell></TableRow>
            ) : (
              transactions?.map((t) => (
                <TableRow key={t.id} className="group">
                  <TableCell className="text-center">
                    <button onClick={() => toggleReconciliation(t.id, t.reconciled)} disabled={isUpdating} className="cursor-pointer">
                      {t.reconciled ? <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" /> : <Circle className="w-5 h-5 text-muted-foreground mx-auto" />}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{format(new Date(t.date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <div className="truncate max-w-full" title={t.description}>
                      {t.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="truncate max-w-full">
                      {t.categoryId ? (
                        <Badge variant="outline" style={{ 
                          borderColor: categories?.find(c => c.id === t.categoryId)?.color,
                          color: categories?.find(c => c.id === t.categoryId)?.color 
                        }}>
                          {categories?.find(c => c.id === t.categoryId)?.name || 'Categorized'}
                        </Badge>
                      ) : (
                        <span className="italic text-xs text-muted-foreground">Non catégorisé</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-bold whitespace-nowrap ${parseInt(t.amount, 10) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatCurrency(t.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditingTransaction(t)} className="h-8 w-8">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(t.id, t.description)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingTransaction && (
        <EditTransactionDialog 
          transaction={editingTransaction} 
          open={!!editingTransaction} 
          onOpenChange={(o) => !o && setEditingTransaction(null)} 
        />
      )}
    </div>
  );
}

function EditTransactionDialog({ transaction, open, onOpenChange }: { transaction: Transaction, open: boolean, onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('Transactions');
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { data: categories } = useCategories(activeAccountId);
  const [date, setDate] = useState(transaction.date.split('T')[0]);
  const [description, setDescription] = useState(transaction.description);
  const [categoryId, setCategoryId] = useState(transaction.categoryId || '');
  const [amount, setAmount] = useState((parseInt(transaction.amount, 10) / 100).toString());
  
  const { mutate: updateTransaction, isPending } = useUpdateTransaction();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    updateTransaction({
      accountId: activeAccountId,
      id: transaction.id,
      data: {
        date,
        description,
        categoryId: categoryId || null,
        amount: (parseFloat(amount) * 100).toString(),
      }
    }, {
      onSuccess: () => {
        toast.success(t('toggled'));
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tc('edit')} Transaction</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.date')}</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.description')}</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.category')}</label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v || '')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Uncategorized</SelectItem>
                {categories?.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.amount')}</label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{tc('save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
