'use client';

import { useState } from 'react';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useTransactions, Transaction } from '../api/use-transactions';
import { useUpdateTransaction } from '../api/use-update-transaction';
import { useDeleteTransaction } from '../api/use-delete-transaction';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useCategories } from '@/features/categories/api/use-categories';
import { useTags } from '@/features/tags/api/use-tags';
import { TagSelector } from '@/features/tags/ui/tag-selector';
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
import { CheckCircle2, Circle, Trash2, Pencil, Repeat, Clock } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
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
import { CreateRecurringDialog } from '@/features/recurring/ui/create-recurring-dialog';

export function TransactionList({ periodId, compact = false }: { periodId?: string, compact?: boolean }) {
  const t = useTranslations('Transactions');
  const { activeAccountId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  const { data: categories } = useCategories(activeAccountId);
  const { data: tags } = useTags(activeAccountId);
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();
  const { mutate: deleteTransaction } = useDeleteTransaction();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionToMakeRecurring, setTransactionToMakeRecurring] = useState<Transaction | null>(null);
  
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

  const togglePending = (transactionId: string, currentStatus: boolean) => {
    if (!activeAccountId) return;
    updateTransaction({
      accountId: activeAccountId,
      id: transactionId,
      data: { pending: !currentStatus }
    }, {
      onSuccess: () => toast.success(t('toggled'))
    });
  };

  const handleDelete = (id: string) => {
    if (!activeAccountId || !confirm(t('delete_confirm'))) return;
    deleteTransaction({ accountId: activeAccountId, id }, {
      onSuccess: () => toast.success(t('deleted'))
    });
  };

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-end gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'reconciled' | 'not_reconciled')}>
          <SelectTrigger className="w-full sm:w-[180px]">
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
            <SelectTrigger className="w-full sm:w-[250px]">
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

      {/* Mobile View: Cards */}
      <div className="lg:hidden space-y-3">
        {transactions?.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            {t('empty')}
          </div>
        ) : (
          transactions?.map((transaction) => (
            <div 
              key={transaction.id} 
              className={cn(
                "p-4 rounded-xl border bg-card shadow-sm space-y-3 active:scale-[0.98] transition-transform",
                transaction.pending && "bg-muted/30 border-dashed"
              )}
              onClick={() => setEditingTransaction(transaction)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleReconciliation(transaction.id, transaction.reconciled);
                    }} 
                    disabled={isUpdating}
                    className="shrink-0"
                  >
                    {transaction.reconciled ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <span className="font-semibold text-sm truncate">{transaction.description}</span>
                </div>
                <div className={cn(
                  "font-bold shrink-0 text-sm",
                  parseInt(transaction.amount, 10) < 0 ? 'text-red-500' : 'text-green-500'
                )}>
                  {formatCurrency(transaction.amount)}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>{format(new Date(transaction.date), 'dd MMM')}</span>
                  {transaction.categoryId && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] py-0" style={{ 
                      borderColor: categories?.find(c => c.id === transaction.categoryId)?.color,
                      color: categories?.find(c => c.id === transaction.categoryId)?.color 
                    }}>
                      {categories?.find(c => c.id === transaction.categoryId)?.name}
                    </Badge>
                  )}
                  {transaction.tagIds?.map(tagId => {
                    const tag = tags?.find(t => t.id === tagId);
                    return (
                      <Badge 
                        key={tagId} 
                        variant="secondary" 
                        className="h-4 px-1 text-[9px] py-0"
                        style={{ 
                          backgroundColor: tag?.color ? `${tag.color}20` : undefined,
                          color: tag?.color,
                          borderColor: tag?.color ? `${tag.color}40` : undefined
                        }}
                      >
                        {tag?.name || 'Tag'}
                      </Badge>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  {transaction.pending && (
                    <div className="flex items-center gap-1 text-orange-500 font-medium">
                      <Clock className="w-3 h-3 animate-pulse" />
                      <span>{t('fields.pending')}</span>
                    </div>
                  )}
                  {!compact && (
                    <Button 
                      variant="ghost" 
                      size="icon-xs" 
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(transaction.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden lg:block border rounded-md overflow-hidden" data-tour="transaction-list">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">Status</TableHead>
              <TableHead className="w-[110px]">{t('fields.date')}</TableHead>
              <TableHead className="w-auto">{t('fields.description')}</TableHead>
              <TableHead className="w-[140px]">{t('fields.category')}</TableHead>
              <TableHead className="w-[100px] text-right">{t('fields.amount')}</TableHead>
              <TableHead className={cn("w-[100px]", compact && "w-[50px]")}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">{t('empty')}</TableCell></TableRow>
            ) : (
              transactions?.map((transaction) => (
                <TableRow key={transaction.id} className={cn("group", transaction.pending && "bg-muted/30")}>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => toggleReconciliation(transaction.id, transaction.reconciled)} disabled={isUpdating} className="cursor-pointer" title={t('fields.reconciled')}>
                        {transaction.reconciled ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                      </button>
                      {transaction.pending && (
                        <button onClick={() => togglePending(transaction.id, transaction.pending)} disabled={isUpdating} className="cursor-pointer" title={t('fields.pending')}>
                          <Clock className="w-4 h-4 text-orange-500 animate-pulse" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{format(new Date(transaction.date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <div className="truncate max-w-full" title={transaction.description}>
                      <div className="flex flex-col gap-1">
                        <span className="truncate">{transaction.description}</span>
                        <div className="flex gap-1 flex-wrap">
                          {transaction.tagIds?.map(tagId => {
                            const tag = tags?.find(t => t.id === tagId);
                            return (
                              <Badge 
                                key={tagId} 
                                variant="secondary" 
                                className="h-4 px-1 text-[9px] py-0 font-normal"
                                style={{ 
                                  backgroundColor: tag?.color ? `${tag.color}20` : undefined,
                                  color: tag?.color,
                                  borderColor: tag?.color ? `${tag.color}40` : undefined
                                }}
                              >
                                {tag?.name || 'Tag'}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="truncate max-w-full">
                      {transaction.categoryId ? (
                        <Badge variant="outline" style={{ 
                          borderColor: categories?.find(c => c.id === transaction.categoryId)?.color,
                          color: categories?.find(c => c.id === transaction.categoryId)?.color 
                        }}>
                          {categories?.find(c => c.id === transaction.categoryId)?.name || 'Categorized'}
                        </Badge>
                      ) : (
                        <span className="italic text-xs text-muted-foreground">Non catégorisé</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-bold whitespace-nowrap ${parseInt(transaction.amount, 10) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!compact && (
                        <Button variant="ghost" size="icon-sm" onClick={() => setTransactionToMakeRecurring(transaction)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Convert to recurring">
                          <Repeat className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditingTransaction(transaction)} className="h-8 w-8">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {!compact && (
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(transaction.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
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

      {transactionToMakeRecurring && (
        <CreateRecurringDialog
          open={!!transactionToMakeRecurring}
          onOpenChange={(open) => !open && setTransactionToMakeRecurring(null)}
          initialData={{
            description: transactionToMakeRecurring.description,
            categoryId: transactionToMakeRecurring.categoryId,
            amount: (parseInt(transactionToMakeRecurring.amount, 10) / 100).toString(),
            dayOfMonth: new Date(transactionToMakeRecurring.date).getDate().toString()
          }}
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
  const [tagIds, setTagIds] = useState<string[]>(transaction.tagIds || []);
  const [amount, setAmount] = useState((parseInt(transaction.amount, 10) / 100).toString());
  const [pending, setPending] = useState(transaction.pending);
  
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
        tagIds,
        amount: Math.round(parseFloat(amount) * 100).toString(),
        pending,
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
              <SelectTrigger>
                <SelectValue>
                  {categoryId ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categories?.find(c => c.id === categoryId)?.color }} />
                      {categories?.find(c => c.id === categoryId)?.name}
                    </div>
                  ) : "Uncategorized"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Uncategorized</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            {activeAccountId && (
              <TagSelector 
                accountId={activeAccountId} 
                selectedTagIds={tagIds} 
                onChange={setTagIds} 
              />
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fields.amount')}</label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
            <Checkbox 
              id="edit-pending" 
              checked={pending} 
              onCheckedChange={(checked) => setPending(!!checked)} 
            />
            <label htmlFor="edit-pending" className="text-sm font-medium cursor-pointer select-none flex-1">
              {t('fields.pending')}
            </label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{tc('save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
