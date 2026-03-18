'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { formatCurrency, toCents, fromCents } from '@/shared/lib/format';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Circle, Trash2, Pencil, Repeat, Clock, Search, Filter, X, Plus, CheckSquare, Square, Receipt } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useBulkUpdateTransactions, useBulkDeleteTransactions } from '../api/use-bulk-transactions';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter 
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useUiStore } from '@/shared/model/use-ui-store';
import { useDebounce } from '@/shared/lib/use-debounce';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { CreateRecurringDialog } from '@/features/recurring/ui/create-recurring-dialog';
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { TransactionForm, TransactionFormValues } from './transaction-form';
import { CategorySelector } from '@/features/categories/ui/category-selector';

export function TransactionList({ 
  periodId, 
  compact = false,
  extraActions
}: { 
  periodId?: string, 
  compact?: boolean,
  extraActions?: React.ReactNode
}) {
  const t = useTranslations('Transactions');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { setTagDetailId, isCreateTransactionDrawerOpen, setCreateTransactionDrawerOpen } = useUiStore();
  const { data: periods } = usePeriods(activeAccountId);
  const { data: categories } = useCategories(activeAccountId);
  const { data: tags } = useTags(activeAccountId);
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();
  const { mutate: deleteTransaction } = useDeleteTransaction();
  const { mutate: bulkUpdate } = useBulkUpdateTransactions();
  const { mutate: bulkDelete } = useBulkDeleteTransactions();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionToMakeRecurring, setTransactionToMakeRecurring] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reconciled' | 'not_reconciled'>('all');
  
  // Use prop if provided, otherwise use activePeriodId (Dashboard), otherwise use local filter state (Transactions page)
  const effectivePeriodId = periodId || (compact ? activePeriodId : selectedPeriodId);
  
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
    periodId: effectivePeriodId === 'all' ? undefined : effectivePeriodId,
    search: debouncedSearch || undefined,
    categoryId: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds.join(',') : undefined,
    minAmount: debouncedMinAmount ? toCents(debouncedMinAmount) : undefined,
    maxAmount: debouncedMaxAmount ? toCents(debouncedMaxAmount) : undefined,
    startDate: debouncedStartDate || undefined,
    endDate: debouncedEndDate || undefined,
    reconciled: statusFilter === 'all' ? undefined : statusFilter === 'reconciled',
    page,
    limit,
  }), [
    effectivePeriodId, 
    debouncedSearch, 
    selectedCategoryId, 
    selectedTagIds, 
    debouncedMinAmount, 
    debouncedMaxAmount, 
    debouncedStartDate, 
    debouncedEndDate, 
    statusFilter,
    page,
    limit
  ]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [
    effectivePeriodId,
    debouncedSearch,
    selectedCategoryId,
    selectedTagIds,
    debouncedMinAmount,
    debouncedMaxAmount,
    debouncedStartDate,
    debouncedEndDate,
    statusFilter,
    limit
  ]);

  const { data: transactions, isLoading } = useTransactions(activeAccountId, filterOptions);

  const toggleSelectAll = () => {
    if (transactions?.data && selectedIds.length === transactions.data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions?.data.map(t => t.id) || []);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Handle Enter key to open transaction drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not already open and not in an input
      if (isCreateTransactionDrawerOpen) return;
      
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.hasAttribute('contenteditable')
      ) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        setCreateTransactionDrawerOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateTransactionDrawerOpen, setCreateTransactionDrawerOpen]);

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

  const toggleReconciliation = useCallback((transactionId: string, currentStatus: boolean) => {
    if (!activeAccountId) return;
    updateTransaction({
      accountId: activeAccountId,
      id: transactionId,
      data: { reconciled: !currentStatus }
    }, {
      onSuccess: () => toast.success(t('toggled'))
    });
  }, [activeAccountId, updateTransaction, t]);

  const handleDelete = useCallback((id: string) => {
    if (!activeAccountId || !confirm(t('delete_confirm'))) return;
    deleteTransaction({ accountId: activeAccountId, id }, {
      onSuccess: () => toast.success(t('deleted'))
    });
  }, [activeAccountId, deleteTransaction, t]);

  // Memoize the heavy list rendering to prevent latency when toggling filters
  const memoizedList = useMemo(() => {
    if (!transactions) return null;

    const generatePageNumbers = () => {
      const totalPages = transactions.meta.totalPages;
      const currentPage = transactions.meta.page;
      const pages = [];
      
      if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (currentPage > 3) pages.push('ellipsis');
        
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        
        for (let i = start; i <= end; i++) {
          if (!pages.includes(i)) pages.push(i);
        }
        
        if (currentPage < totalPages - 2) pages.push('ellipsis');
        if (!pages.includes(totalPages)) pages.push(totalPages);
      }
      return pages;
    };

    return (
      <>
        {/* Mobile View: Cards */}
        <div className="lg:hidden space-y-3">
          {transactions.data.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              {t('empty')}
            </div>
          ) : (
            transactions.data.map((transaction) => (
              <div 
                key={transaction.id} 
                className={cn(
                  "p-4 rounded-xl border bg-card transition-all active:scale-[0.98] flex gap-3",
                  transaction.reconciled ? "border-green-500/20 bg-green-500/5" : "shadow-sm",
                  selectedIds.includes(transaction.id) && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => selectedIds.length > 0 ? toggleSelect(transaction.id) : setEditingTransaction(transaction)}
              >
                <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                  {!compact && (
                    <Checkbox 
                      checked={selectedIds.includes(transaction.id)} 
                      onCheckedChange={() => toggleSelect(transaction.id)}
                    />
                  )}
                </div>
                <div className="flex-1 space-y-3">
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
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn(
                        "text-sm font-black tracking-tight",
                        parseInt(transaction.amount, 10) < 0 ? "text-red-500" : "text-green-500"
                      )}>
                        {formatCurrency(transaction.amount)}
                      </span>
                      {transaction.pending && (
                        <div className="flex items-center gap-1 text-orange-500 font-medium">
                          <Clock className="w-3 h-3 animate-pulse" />
                          <span className="text-[9px] uppercase tracking-wider">Attente</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {transaction.tagIds && transaction.tagIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {transaction.tagIds.map(tagId => {
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
                  )}
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
                {!compact && (
                  <TableHead className="w-[40px]">
                    <Checkbox 
                      checked={transactions.data.length > 0 && selectedIds.length === transactions.data.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[120px]">{t('fields.date')}</TableHead>
                <TableHead className="min-w-[200px] max-w-[400px]">{t('fields.description')}</TableHead>
                <TableHead className="w-[180px]">{t('fields.category')}</TableHead>
                <TableHead className="text-right w-[150px]">{t('fields.amount')}</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.data.map((transaction) => (
                  <TableRow 
                    key={transaction.id} 
                    className={cn(
                      "group cursor-pointer",
                      transaction.pending && "bg-muted/20 opacity-80",
                      selectedIds.includes(transaction.id) && "bg-primary/5"
                    )}
                    onClick={() => selectedIds.length > 0 ? toggleSelect(transaction.id) : setEditingTransaction(transaction)}
                  >
                    {!compact && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedIds.includes(transaction.id)} 
                          onCheckedChange={() => toggleSelect(transaction.id)}
                        />
                      </TableCell>
                    )}
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
                        {!compact && (
                          <Button variant="ghost" size="icon-xs" onClick={() => setTransactionToMakeRecurring(transaction)} title="Rendre récurrente">
                            <Repeat className="w-3.5 h-3.5" />
                          </Button>
                        )}
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

        {/* Pagination Controls */}
        {!compact && transactions.meta.totalPages >= 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t bg-muted/5 rounded-b-xl mt-4 gap-4">
            <div className="flex items-center gap-6">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                {transactions.meta.total} transactions
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap">Afficher</span>
                <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v || '25', 10))}>
                  <SelectTrigger className="h-8 w-[70px] text-xs bg-background">
                    <SelectValue>{limit}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100, 250].map(val => (
                      <SelectItem key={val} value={val.toString()}>{val}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    className={cn(
                      "h-8 text-[10px] font-bold uppercase tracking-widest cursor-pointer",
                      transactions.meta.page === 1 && "pointer-events-none opacity-50"
                    )}
                    onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }}
                  />
                </PaginationItem>
                
                {generatePageNumbers().map((p, i) => (
                  <PaginationItem key={i}>
                    {p === 'ellipsis' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink 
                        className="h-8 w-8 text-xs font-bold cursor-pointer"
                        isActive={p === transactions.meta.page}
                        onClick={(e) => { e.preventDefault(); setPage(p as number); }}
                      >
                        {p}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext 
                    className={cn(
                      "h-8 text-[10px] font-bold uppercase tracking-widest cursor-pointer",
                      (transactions.meta.page === transactions.meta.totalPages || transactions.meta.totalPages === 0) && "pointer-events-none opacity-50"
                    )}
                    onClick={(e) => { e.preventDefault(); setPage(p => Math.min(transactions.meta.totalPages, p + 1)); }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </>
    );
  }, [transactions, categories, tags, t, isUpdating, handleDelete, setTagDetailId, toggleReconciliation, compact, selectedIds, toggleSelectAll, setPage, limit, setLimit]);

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  return (
    <div className={cn("flex flex-col h-full", !compact && "space-y-4")}>
      {/* Header with Title and Add Button */}
      <div className={cn("flex items-center justify-between shrink-0", compact && "bg-muted/10 px-6 py-3 border-b")}>
        <div className="flex items-center gap-2">
          {compact && <Receipt className="w-4 h-4 text-primary" />}
          <h2 className={cn("font-bold tracking-tight", compact ? "text-[10px] uppercase tracking-wider text-muted-foreground" : "text-3xl")}>{t('title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {extraActions}
          <Button size={compact ? "icon-xs" : "sm"} variant={compact ? "ghost" : "default"} className="gap-2" onClick={() => setCreateTransactionDrawerOpen(true)}>
            <Plus className="w-4 h-4" />
            {!compact && <span className="hidden sm:inline">{t('add_transaction')}</span>}
          </Button>
        </div>
      </div>

      {/* Search & Filter Header - Only shown if not compact */}
      {!compact && (
        <div className="flex flex-col gap-4 shrink-0">
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
                  <CategorySelector 
                    key={activeAccountId}
                    accountId={activeAccountId}
                    value={selectedCategoryId === 'all' ? '' : selectedCategoryId}
                    onChange={(v) => setSelectedCategoryId(v || 'all')}
                    placeholder={t('all_categories')}
                    className="h-10 bg-background"
                  />
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
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'reconciled' | 'not_reconciled')}>
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
                      <Select value={effectivePeriodId} onValueChange={(v) => setSelectedPeriodId(v || 'all')}>
                        <SelectTrigger className="h-10 bg-background">
                          <SelectValue>
                            {effectivePeriodId === 'all' 
                              ? t('all_periods') 
                              : (function() {
                                  const p = periods?.find(p => p.id === effectivePeriodId);
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

      <div className="flex-1 min-h-0 overflow-y-auto">
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
            amount: fromCents(transactionToMakeRecurring.amount),
            categoryId: transactionToMakeRecurring.categoryId || undefined,
          }}
        />
      )}

      {/* Bulk Actions Floating Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 border border-primary-foreground/20">
            <div className="flex items-center gap-2 pr-4 border-r border-primary-foreground/20">
              <span className="text-sm font-black">{selectedIds.length}</span>
              <span className="text-xs uppercase tracking-wider font-bold opacity-80">Sélectionnés</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary-foreground hover:bg-primary-foreground/10 gap-2 h-9"
                onClick={() => {
                  if (confirm(`Supprimer ${selectedIds.length} opérations ?`)) {
                    if (activeAccountId) {
                      bulkDelete({ accountId: activeAccountId, ids: selectedIds }, {
                        onSuccess: () => {
                          toast.success(`${selectedIds.length} opérations supprimées`);
                          setSelectedIds([]);
                        }
                      });
                    }
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-xs font-bold">Supprimer</span>
              </Button>

              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary-foreground hover:bg-primary-foreground/10 gap-2 h-9"
                onClick={() => {
                  if (activeAccountId) {
                    bulkUpdate({ 
                      accountId: activeAccountId, 
                      command: { ids: selectedIds, data: { reconciled: true } }
                    }, {
                      onSuccess: () => {
                        toast.success(`${selectedIds.length} opérations pointées`);
                        setSelectedIds([]);
                      }
                    });
                  }
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold">Pointer</span>
              </Button>

              <div className="w-px h-6 bg-primary-foreground/20 mx-2" />

              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary-foreground hover:bg-primary-foreground/10 h-9"
                onClick={() => setSelectedIds([])}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditTransactionDialog({ transaction, open, onOpenChange }: { transaction: Transaction, open: boolean, onOpenChange: (o: boolean) => void }) {
  const tc = useTranslations('Common');
  const { activeAccountId } = useAccountStore();
  const { mutate: updateTransaction, isPending } = useUpdateTransaction();

  const handleSubmit = (values: TransactionFormValues) => {
    if (!activeAccountId) return;

    updateTransaction({
      accountId: activeAccountId,
      id: transaction.id,
      data: {
        date: values.date,
        description: values.description,
        categoryId: values.categoryId || null,
        tagIds: values.tagIds,
        amount: toCents(values.amount),
        pending: values.pending,
      }
    }, {
      onSuccess: () => {
        toast.success(tc('success'));
        onOpenChange(false);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>{tc('edit')} Transaction</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          <TransactionForm 
            accountId={activeAccountId}
            initialValues={{
              date: transaction.date.split('T')[0],
              description: transaction.description,
              categoryId: transaction.categoryId || '',
              tagIds: transaction.tagIds || [],
              amount: fromCents(transaction.amount),
              pending: transaction.pending,
            }}
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel={tc('save')}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
