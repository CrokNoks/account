'use client';

import { useState, useMemo } from 'react';
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
import { CheckCircle2, Circle, Trash2, Pencil, Repeat, Clock, Search, Filter, X } from 'lucide-react';
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
import { useUiStore } from '@/shared/model/use-ui-store';
import { useDebounce } from '@/shared/lib/use-debounce';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { CreateRecurringDialog } from '@/features/recurring/ui/create-recurring-dialog';

export function TransactionList({ periodId, compact = false }: { periodId?: string, compact?: boolean }) {
  const t = useTranslations('Transactions');
  const { activeAccountId } = useAccountStore();
  const { setTagDetailId } = useUiStore();
  const { data: periods } = usePeriods(activeAccountId);
  const { data: categories } = useCategories(activeAccountId);
  const { data: tags } = useTags(activeAccountId);
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();
  const { mutate: deleteTransaction } = useDeleteTransaction();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionToMakeRecurring, setTransactionToMakeRecurring] = useState<Transaction | null>(null);
  
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | 'all'>(periodId || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reconciled' | 'not_reconciled'>('all');
  
  // Advanced filters state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState('');
  const debouncedMinAmount = useDebounce(minAmount, 500);
  const [maxAmount, setMaxAmount] = useState('');
  const debouncedMaxAmount = useDebounce(maxAmount, 500);
  const [startDate, setStartDate] = useState('');
  const debouncedStartDate = useDebounce(startDate, 500);
  const [endDate, setEndDate] = useState('');
  const debouncedEndDate = useDebounce(endDate, 500);

  const filterOptions = useMemo(() => ({
    periodId: selectedPeriodId === 'all' ? undefined : selectedPeriodId,
    search: debouncedSearch || undefined,
    categoryId: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    minAmount: debouncedMinAmount ? Math.round(parseFloat(debouncedMinAmount) * 100).toString() : undefined,
    maxAmount: debouncedMaxAmount ? Math.round(parseFloat(debouncedMaxAmount) * 100).toString() : undefined,
    startDate: debouncedStartDate || undefined,
    endDate: debouncedEndDate || undefined,
    reconciled: statusFilter === 'all' ? undefined : statusFilter === 'reconciled',
  }), [
    selectedPeriodId, 
    debouncedSearch, 
    selectedCategoryId, 
    selectedTagIds, 
    debouncedMinAmount, 
    debouncedMaxAmount, 
    debouncedStartDate, 
    debouncedEndDate, 
    statusFilter
  ]);

  const { data: transactions, isLoading } = useTransactions(activeAccountId, filterOptions);

  const resetFilters = () => {
    setSearch('');
    setSelectedCategoryId('all');
    setSelectedTagIds([]);
    setMinAmount('');
    setMaxAmount('');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
  };

  const activeFiltersCount = [
    search, 
    selectedCategoryId !== 'all', 
    selectedTagIds.length > 0, 
    minAmount, 
    maxAmount, 
    startDate, 
    endDate, 
    statusFilter !== 'all'
  ].filter(Boolean).length;

  // Memoize the heavy list rendering to prevent latency when toggling filters
  const memoizedList = useMemo(() => {
    if (!transactions) return null;

    return (
      <>
        {/* Mobile View: Cards */}
        <div className="lg:hidden space-y-3">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              {t('empty')}
            </div>
          ) : (
            transactions.map((transaction) => (
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
                      {transaction.reconciled ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 fill-green-500/10" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground/30" />
                      )}
                    </button>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold truncate">{transaction.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{format(new Date(transaction.date), 'dd MMM')}</span>
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
                              className="h-4 px-1 text-[9px] py-0 cursor-pointer hover:brightness-90 transition-all"
                              style={{ 
                                backgroundColor: tag?.color ? `${tag.color}20` : undefined,
                                color: tag?.color,
                                borderColor: tag?.color ? `${tag.color}40` : undefined
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTagDetailId(tagId);
                              }}
                            >
                              {tag?.name || 'Tag'}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn(
                      "text-sm font-black tracking-tight",
                      parseInt(transaction.amount, 10) < 0 ? "text-red-500" : "text-green-500"
                    )}>
                      {formatCurrency(transaction.amount)}
                    </span>
                    <div className="flex items-center gap-2">
                    {transaction.pending && (
                      <div className="flex items-center gap-1 text-orange-500 font-medium">
                        <Clock className="w-3 h-3 animate-pulse" />
                        <span className="text-[9px] uppercase tracking-wider">Attente</span>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[120px]">{t('fields.date')}</TableHead>
                <TableHead className="min-w-[200px] max-w-[400px]">{t('fields.description')}</TableHead>
                <TableHead className="w-[180px]">{t('fields.category')}</TableHead>
                <TableHead className="text-right w-[150px]">{t('fields.amount')}</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow 
                    key={transaction.id} 
                    className={cn(
                      "group cursor-pointer",
                      transaction.pending && "bg-muted/20 opacity-80"
                    )}
                    onClick={() => setEditingTransaction(transaction)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => toggleReconciliation(transaction.id, transaction.reconciled)}
                        disabled={isUpdating}
                        className="hover:scale-110 transition-transform"
                      >
                        {transaction.reconciled ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 fill-green-500/10" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground/30" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium">
                      {format(new Date(transaction.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="max-w-[400px]">
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
                                  className="h-4 px-1 text-[9px] py-0 font-normal cursor-pointer hover:brightness-90 transition-all"
                                  style={{ 
                                    backgroundColor: tag?.color ? `${tag.color}20` : undefined,
                                    color: tag?.color,
                                    borderColor: tag?.color ? `${tag.color}40` : undefined
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTagDetailId(tagId);
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
                          <Badge variant="outline" className="gap-1.5" style={{ 
                            borderColor: categories?.find(c => c.id === transaction.categoryId)?.color,
                            color: categories?.find(c => c.id === transaction.categoryId)?.color 
                          }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categories?.find(c => c.id === transaction.categoryId)?.color }} />
                            {categories?.find(c => c.id === transaction.categoryId)?.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-black tracking-tight",
                      parseInt(transaction.amount, 10) < 0 ? "text-red-500" : "text-green-500"
                    )}>
                      <div className="flex flex-col items-end gap-0.5">
                        {formatCurrency(transaction.amount)}
                        {transaction.pending && (
                          <span className="text-[8px] uppercase tracking-widest text-orange-500 font-bold bg-orange-500/10 px-1 rounded">Attente</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon-xs" onClick={() => setTransactionToMakeRecurring(transaction)} title="Rendre récurrente">
                          <Repeat className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => setEditingTransaction(transaction)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" className="text-destructive" onClick={() => handleDelete(transaction.id)}>
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
      </>
    );
  }, [transactions, categories, tags, t, isUpdating, isUpdating]);

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
      {/* Search & Filter Header - Only shown if not compact */}
      {!compact && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder={t('search_placeholder')} 
                className="pl-10 h-11" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                  onClick={() => setSearch('')}
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </Button>
              )}
            </div>
            <Button 
              variant={isFilterOpen ? "default" : "outline"}
              className="h-11 gap-2 relative px-4"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">{t('filter_title')}</span>
              {activeFiltersCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 rounded-full border-2 border-background text-[10px]">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          {isFilterOpen && (
            <div className="p-4 rounded-xl border bg-muted/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">{t('fields.category')}</label>
                  <Select value={selectedCategoryId} onValueChange={(v) => setSelectedCategoryId(v || 'all')}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue placeholder={t('all_categories')}>
                        {selectedCategoryId === 'all' 
                          ? t('all_categories') 
                          : categories?.find(c => c.id === selectedCategoryId)?.name
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_categories')}</SelectItem>
                      {categories?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">Tags</label>
                  {activeAccountId && (
                    <TagSelector 
                      accountId={activeAccountId} 
                      selectedTagIds={selectedTagIds} 
                      onChange={setSelectedTagIds}
                    />
                  )}
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">{t('filter_status')}</label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <SelectTrigger className="h-10 bg-background">
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
                </div>

                {/* Amount Range */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">{t('amount_range')}</label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      placeholder="Min" 
                      className="h-10 bg-background" 
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                      type="number" 
                      placeholder="Max" 
                      className="h-10 bg-background" 
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                    />
                  </div>
                </div>

                {/* Date Range & Period (Full width row) */}
                {!periodId && (
                  <>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">{t('date_range')}</label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="date" 
                          className="h-10 bg-background" 
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-muted-foreground text-xs">au</span>
                        <Input 
                          type="date" 
                          className="h-10 bg-background" 
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">{t('budget_period')}</label>
                      <Select value={selectedPeriodId} onValueChange={(v) => setSelectedPeriodId(v || 'all')}>
                        <SelectTrigger className="h-10 bg-background">
                          <SelectValue>
                            {selectedPeriodId === 'all' 
                              ? t('all_periods') 
                              : (function() {
                                  const p = periods?.find(p => p.id === selectedPeriodId);
                                  return p ? `${format(new Date(p.startDate), 'dd/MM/yy')} - ${format(new Date(p.endDate), 'dd/MM/yy')}` : t('budget_period');
                                })()
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('all_periods')}</SelectItem>
                          {periods?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {format(new Date(p.startDate), 'dd/MM/yyyy')} - {format(new Date(p.endDate), 'dd/MM/yyyy')} {p.isActive && "(Active)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2 hover:bg-destructive/10 hover:text-destructive" onClick={resetFilters}>
                  <X className="w-3 h-3" />
                  {t('reset_filters')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border shadow-sm overflow-hidden">
        {memoizedList}
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
          onOpenChange={(o) => !o && setTransactionToMakeRecurring(null)}
          initialData={{
            description: transactionToMakeRecurring.description,
            amount: transactionToMakeRecurring.amount,
            categoryId: transactionToMakeRecurring.categoryId || undefined,
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
        toast.success(tc('success'));
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tc('edit')} Transaction</DialogTitle>
        </DialogHeader>
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
                <SelectValue placeholder="Sélectionner une catégorie..." />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
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
            <label htmlFor="edit-pending" className="text-sm font-medium leading-none cursor-pointer">
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
