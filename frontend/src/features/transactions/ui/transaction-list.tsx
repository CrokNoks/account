'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useTransactions } from '../api/use-transactions';
import { useUpdateTransaction } from '../api/use-update-transaction';
import { useDeleteTransaction } from '../api/use-delete-transaction';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useCategories } from '@/features/categories/api/use-categories';
import { useTags } from '@/features/tags/api/use-tags';
import { toCents, fromCents } from '@/shared/lib/format';
import { Plus, Receipt } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useBulkUpdateTransactions, useBulkDeleteTransactions } from '../api/use-bulk-transactions';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from "@/components/ui/sheet";
import { useUiStore } from '@/shared/model/use-ui-store';
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
import { TransactionTable } from './transaction-table';
import { TransactionMobileList } from './transaction-mobile-list';
import { TransactionFilters } from './transaction-filters';
import { BulkActionsBar } from './bulk-actions-bar';
import { Transaction } from '../model/types';

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
  const [limit] = useState(25);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reconciled' | 'not_reconciled'>('all');
  
  const effectivePeriodId = periodId || (compact ? activePeriodId : selectedPeriodId);
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    categoryId: 'all',
    selectedTagIds: [] as string[],
    statusFilter: 'all',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
  });

  const filterOptions = useMemo(() => ({
    periodId: effectivePeriodId === 'all' ? undefined : (effectivePeriodId || undefined),
    search: appliedFilters.search || undefined,
    categoryId: appliedFilters.categoryId === 'all' ? undefined : appliedFilters.categoryId,
    tagIds: appliedFilters.selectedTagIds.length > 0 ? appliedFilters.selectedTagIds.join(',') : undefined,
    minAmount: appliedFilters.minAmount ? toCents(appliedFilters.minAmount) : undefined,
    maxAmount: appliedFilters.maxAmount ? toCents(appliedFilters.maxAmount) : undefined,
    startDate: appliedFilters.startDate || undefined,
    endDate: appliedFilters.endDate || undefined,
    reconciled: appliedFilters.statusFilter === 'all' ? undefined : appliedFilters.statusFilter === 'reconciled',
    page,
    limit,
  }), [page, limit, effectivePeriodId, appliedFilters]);

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters({
      search,
      categoryId: selectedCategoryId,
      selectedTagIds,
      statusFilter,
      minAmount,
      maxAmount,
      startDate,
      endDate,
    });
  };

  const handleResetFilters = () => {
    const defaultFilters = {
      search: '',
      categoryId: 'all',
      selectedTagIds: [],
      statusFilter: 'all',
      minAmount: '',
      maxAmount: '',
      startDate: '',
      endDate: '',
    };
    setSearch('');
    setSelectedCategoryId('all');
    setSelectedTagIds([]);
    setMinAmount('');
    setMaxAmount('');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setPage(1);
    setAppliedFilters(defaultFilters);
  };

  const activeFiltersCount = useMemo(() => {
    return [
      appliedFilters.search,
      appliedFilters.categoryId !== 'all',
      appliedFilters.selectedTagIds.length > 0,
      appliedFilters.minAmount,
      appliedFilters.maxAmount,
      appliedFilters.startDate,
      appliedFilters.endDate,
      appliedFilters.statusFilter !== 'all'
    ].filter(Boolean).length;
  }, [appliedFilters]);

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

  const handleBulkDelete = () => {
    if (!activeAccountId || selectedIds.length === 0 || !confirm(`Supprimer ${selectedIds.length} transactions ?`)) return;
    bulkDelete({ accountId: activeAccountId, ids: selectedIds }, {
      onSuccess: () => {
        toast.success(`${selectedIds.length} transactions supprimées`);
        setSelectedIds([]);
      }
    });
  };

  const handleBulkReconcile = () => {
    if (!activeAccountId || selectedIds.length === 0) return;
    bulkUpdate({ 
      accountId: activeAccountId, 
      command: {
        ids: selectedIds, 
        data: { reconciled: true } 
      }
    }, {
      onSuccess: () => {
        toast.success(`${selectedIds.length} transactions pointées`);
        setSelectedIds([]);
      }
    });
  };

  const generatePageNumbers = () => {
    if (!transactions) return [];
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCreateTransactionDrawerOpen) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.hasAttribute('contenteditable')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        setCreateTransactionDrawerOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateTransactionDrawerOpen, setCreateTransactionDrawerOpen]);

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  return (
    <div className={cn("flex flex-col h-full", !compact && "space-y-4")}>
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

      {!compact && (
        <TransactionFilters 
          search={search} setSearch={setSearch}
          isFilterOpen={isFilterOpen} setIsFilterOpen={setIsFilterOpen}
          activeFiltersCount={activeFiltersCount}
          activeAccountId={activeAccountId}
          selectedCategoryId={selectedCategoryId} setSelectedCategoryId={setSelectedCategoryId}
          selectedTagIds={selectedTagIds} setSelectedTagIds={setSelectedTagIds}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          minAmount={minAmount} setMinAmount={setMinAmount}
          maxAmount={maxAmount} setMaxAmount={setMaxAmount}
          startDate={startDate} setStartDate={setStartDate}
          endDate={endDate} setEndDate={setEndDate}
          effectivePeriodId={effectivePeriodId || 'all'} setSelectedPeriodId={setSelectedPeriodId}
          periods={periods} periodId={periodId}
          onApply={handleApplyFilters} onReset={handleResetFilters}
          t={t}
        />
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {transactions && (
          <>
            <TransactionMobileList 
              transactions={transactions.data}
              categories={categories} tags={tags}
              selectedIds={selectedIds} onToggleSelect={toggleSelect}
              onEdit={setEditingTransaction} onToggleReconciliation={toggleReconciliation}
              onTagClick={setTagDetailId} compact={compact} isUpdating={isUpdating} t={t}
            />
            <TransactionTable 
              transactions={transactions.data}
              categories={categories} tags={tags}
              selectedIds={selectedIds} onToggleSelect={toggleSelect} onToggleSelectAll={toggleSelectAll}
              onEdit={setEditingTransaction} onDelete={handleDelete} onToggleReconciliation={toggleReconciliation}
              onMakeRecurring={setTransactionToMakeRecurring} onTagClick={setTagDetailId}
              compact={compact} isUpdating={isUpdating} t={t}
            />
          </>
        )}
      </div>

      {!compact && transactions && transactions.meta.totalPages >= 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t bg-muted/5 rounded-b-xl mt-4 gap-4">
          <div className="flex items-center gap-6">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
              {transactions.meta.total} {t('title').toLowerCase()}
            </div>
            {/* Limit Selector could be extracted too but it's small */}
          </div>

          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  className={cn("h-8 text-[10px] font-bold uppercase tracking-widest cursor-pointer", transactions.meta.page === 1 && "pointer-events-none opacity-50")}
                  onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }}
                />
              </PaginationItem>
              {generatePageNumbers().map((p, i) => (
                <PaginationItem key={i}>
                  {p === 'ellipsis' ? <PaginationEllipsis /> : (
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
                  className={cn("h-8 text-[10px] font-bold uppercase tracking-widest cursor-pointer", (transactions.meta.page === transactions.meta.totalPages || transactions.meta.totalPages === 0) && "pointer-events-none opacity-50")}
                  onClick={(e) => { e.preventDefault(); setPage(p => Math.min(transactions.meta.totalPages, p + 1)); }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <BulkActionsBar 
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        onBulkDelete={handleBulkDelete}
        onBulkReconcile={handleBulkReconcile}
      />

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
            categoryId: transactionToMakeRecurring.categoryId || '',
            dayOfMonth: new Date(transactionToMakeRecurring.date).getDate().toString()
          }}
        />
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
