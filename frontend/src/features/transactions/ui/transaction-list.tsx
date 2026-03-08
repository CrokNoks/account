'use client';

import { useState } from 'react';
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

export function TransactionList() {
  const { activeAccountId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();
  const { mutate: deleteTransaction, isPending: isDeleting } = useDeleteTransaction();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | 'all'>('all');
  const filterPeriodId = selectedPeriodId === 'all' ? null : selectedPeriodId;
  const { data: transactions, isLoading } = useTransactions(activeAccountId, filterPeriodId);

  const toggleReconciliation = (transactionId: string, currentStatus: boolean) => {
    if (!activeAccountId) return;
    updateTransaction({
      accountId: activeAccountId,
      id: transactionId,
      data: { reconciled: !currentStatus }
    }, {
      onSuccess: () => toast.success(currentStatus ? 'Transaction un-pointed' : 'Transaction reconciled')
    });
  };

  const handleDelete = (id: string, description: string) => {
    if (!activeAccountId || !confirm(`Delete "${description}"?`)) return;
    deleteTransaction({ accountId: activeAccountId, id }, {
      onSuccess: () => toast.success(`Transaction deleted`)
    });
  };

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={selectedPeriodId} onValueChange={(v) => setSelectedPeriodId(v || 'all')}>
          <SelectTrigger className="w-[250px]"><SelectValue placeholder="Filter by period" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Transactions</SelectItem>
            {periods?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {format(new Date(p.startDate), 'dd/MM/yy')} - {format(new Date(p.endDate), 'dd/MM/yy')} {p.isActive && "(Active)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">No transactions found.</TableCell></TableRow>
            ) : (
              transactions?.map((t) => (
                <TableRow key={t.id} className="group">
                  <TableCell>
                    <button onClick={() => toggleReconciliation(t.id, t.reconciled)} disabled={isUpdating}>
                      {t.reconciled ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{format(new Date(t.date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell>{t.categoryId ? <Badge variant="outline">Categorized</Badge> : <span className="italic text-xs">Uncategorized</span>}</TableCell>
                  <TableCell className={`text-right font-bold ${parseInt(t.amount, 10) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatCurrency(t.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        toast.success(`Transaction updated`);
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v || '')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Uncategorized</SelectItem>
                {categories?.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount</label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
