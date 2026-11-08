'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useTransactions } from '../api/use-transactions';
import { useUpdateTransaction } from '../api/use-update-transaction';
import { useDeleteTransaction } from '../api/use-delete-transaction';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useCategories } from '@/features/categories/api/use-categories';
import { useTags } from '@/features/tags/api/use-tags';
import { toCents, centsToInputString, isUnreadableAmount, toOptionalCents } from '@/shared/lib/format';
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
import { getApiErrorMessage } from '@/shared/api/mutation-error';
import { useLocale, useTranslations } from 'next-intl';
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
import { useAnomalies } from '@/features/reporting/api/use-anomalies';
import { anomalyMarks } from '../model/anomaly-marks';
import { operationState, stateFilterToQuery, type StateFilter } from '../model/operation-state';
import { useReportingStats } from '@/features/reporting/api/use-reporting-stats';

export function TransactionList({ 
  periodId, 
  period,
  initialFilters,
  compact = false,
  extraActions
}: { 
  periodId?: string, 
  /** Période pilotée par l'écran (sélecteur de tête) : un identifiant ou `all`. Le filtre de période du panneau disparaît. */
  period?: string,
  /** Filtres venus d'un lien (identifiants exacts, catégorie, état). */
  initialFilters?: { ids?: string[]; categoryId?: string; state?: 'a_pointer' },
  compact?: boolean,
  extraActions?: React.ReactNode
}) {
  const t = useTranslations('Transactions');
  const tApi = useTranslations('ApiErrors');
  const tc = useTranslations('Common');
  const locale = useLocale();
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
  const [selection, setSelection] = useState<{ scope: string; ids: string[] }>({ scope: '', ids: [] });
  
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | 'all'>('all');
  // Filtre d'état : appliqué tout de suite (hors panneau), il se combine avec les autres filtres.
  const [stateFilter, setStateFilter] = useState<StateFilter>(initialFilters?.state ?? 'all');
  // Lignes pointées depuis « Facture à venir » pendant la session de l'écran : seules elles proposent « Remettre en facture à venir ».
  const [pointedFromUpcoming, setPointedFromUpcoming] = useState<Set<string>>(() => new Set());
  
  const effectivePeriodId = periodId || (compact ? activePeriodId : (period ?? selectedPeriodId));
  
  // Changer de période ramène à la première page (réinitialisation pendant le rendu).
  const [pageOfPeriod, setPageOfPeriod] = useState(effectivePeriodId);
  if (pageOfPeriod !== effectivePeriodId) {
    setPageOfPeriod(effectivePeriodId);
    setPage(1);
  }

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>(initialFilters?.categoryId ?? 'all');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [appliedFilters, setAppliedFilters] = useState({
    ids: initialFilters?.ids ?? ([] as string[]),
    search: '',
    categoryId: initialFilters?.categoryId ?? 'all',
    selectedTagIds: [] as string[],
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
  });

  const filterOptions = useMemo(() => ({
    periodId: effectivePeriodId === 'all' ? undefined : (effectivePeriodId || undefined),
    ids: appliedFilters.ids.length > 0 ? appliedFilters.ids.join(',') : undefined,
    search: appliedFilters.search || undefined,
    categoryId: appliedFilters.categoryId === 'all' ? undefined : appliedFilters.categoryId,
    tagIds: appliedFilters.selectedTagIds.length > 0 ? appliedFilters.selectedTagIds.join(',') : undefined,
    minAmount: toOptionalCents(appliedFilters.minAmount),
    maxAmount: toOptionalCents(appliedFilters.maxAmount),
    startDate: appliedFilters.startDate || undefined,
    endDate: appliedFilters.endDate || undefined,
    ...stateFilterToQuery(stateFilter),
    page,
    limit,
  }), [page, limit, effectivePeriodId, appliedFilters, stateFilter]);

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters({
      // Les identifiants d'un lien ne s'éditent pas ici : ils tiennent jusqu'à la réinitialisation.
      ids: appliedFilters.ids,
      search,
      categoryId: selectedCategoryId,
      selectedTagIds,
      minAmount,
      maxAmount,
      startDate,
      endDate,
    });
  };

  const handleResetFilters = () => {
    const defaultFilters = {
      ids: [] as string[],
      search: '',
      categoryId: 'all',
      selectedTagIds: [],
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
    setStateFilter('all');
    setPage(1);
    setAppliedFilters(defaultFilters);
  };

  const activeFiltersCount = useMemo(() => {
    return [
      appliedFilters.ids.length > 0,
      appliedFilters.search,
      appliedFilters.categoryId !== 'all',
      appliedFilters.selectedTagIds.length > 0,
      toOptionalCents(appliedFilters.minAmount),
      toOptionalCents(appliedFilters.maxAmount),
      appliedFilters.startDate,
      appliedFilters.endDate,
      stateFilter !== 'all'
    ].filter(Boolean).length;
  }, [appliedFilters, stateFilter]);

  // N du filtre « À pointer » : le reste à pointer de la période choisie (stats existantes, comme les soldes de tête).
  const { data: periodStats } = useReportingStats(activeAccountId, compact ? null : activePeriodId);
  const handleStateChange = (value: StateFilter) => {
    setPage(1);
    setStateFilter(value);
  };

  const { data: transactions, isLoading, isError } = useTransactions(activeAccountId, filterOptions);
  // Anomalies de la période partagée avec Aujourd'hui (ignorées exclues par le back) : marques sur les lignes.
  const { data: anomalies } = useAnomalies(activeAccountId, activePeriodId);
  const marks = useMemo(() => anomalyMarks(anomalies), [anomalies]);

  // La sélection appartient à un « scope » (compte, page, période, filtres, recherche) :
  // dès que le scope change elle est vidée (réinitialisation pendant le rendu, comme
  // le recommande React), donc jamais de sélection invisible, même en revenant en arrière.
  const selectionScope = useMemo(() => JSON.stringify([activeAccountId, filterOptions]), [activeAccountId, filterOptions]);
  if (selection.scope !== selectionScope) {
    setSelection({ scope: selectionScope, ids: [] });
  }
  const selectedIds = useMemo(
    () => (selection.scope === selectionScope ? selection.ids : []),
    [selection, selectionScope],
  );
  const setSelectedIds = (update: string[] | ((prev: string[]) => string[])) =>
    setSelection(prev => ({
      scope: selectionScope,
      ids: typeof update === 'function' ? update(prev.scope === selectionScope ? prev.ids : []) : update,
    }));

  // Seuls les ids de la liste affichée (compte courant, page et filtres courants)
  // sont envoyés aux actions en lot : l'API répond 404 pour tout id inconnu du compte.
  const displayedIds = useMemo(() => new Set(transactions?.data.map(t => t.id) ?? []), [transactions]);
  const bulkIds = useMemo(() => selectedIds.filter(id => displayedIds.has(id)), [selectedIds, displayedIds]);

  const bulkErrorMessage = (err: unknown) => getApiErrorMessage(err, tc('error'), tApi);

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

  // Pointer / dépointer : un geste, sans dialogue. Rien n'est modifié à l'écran avant la réponse du serveur
  // (en cas d'échec, la ligne garde son état et le toast d'erreur global s'affiche).
  const togglePointage = useCallback((transaction: Transaction) => {
    if (!activeAccountId) return;
    const state = operationState(transaction);
    const id = transaction.id;
    if (state === 'pointee') {
      update(id, { reconciled: false }, () => {
        if (pointedFromUpcoming.has(id)) {
          setPointedFromUpcoming(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          // Dépointer ne restaure pas `pending` : on le dit, avec le moyen de la remettre en facture à venir.
          toast.info(t('unpointed_to_point'), {
            action: {
              label: t('back_to_upcoming'),
              onClick: () => update(id, { pending: true }, () => toast.success(t('back_to_upcoming_done'))),
            },
          });
        } else {
          toast.success(t('toggled'));
        }
      });
    } else {
      update(id, { reconciled: true }, () => {
        if (state === 'a_venir') setPointedFromUpcoming(prev => new Set(prev).add(id));
        toast.success(t('toggled'));
      });
    }

    function update(txId: string, data: Partial<Transaction>, onSuccess: () => void) {
      updateTransaction({ accountId: activeAccountId!, id: txId, data }, { onSuccess });
    }
  }, [activeAccountId, updateTransaction, pointedFromUpcoming, t]);

  const handleDelete = useCallback((id: string) => {
    if (!activeAccountId || !confirm(t('delete_confirm'))) return;
    deleteTransaction({ accountId: activeAccountId, id }, {
      onSuccess: () => toast.success(t('deleted'))
    });
  }, [activeAccountId, deleteTransaction, t]);

  const handleBulkDelete = () => {
    if (!activeAccountId || bulkIds.length === 0 || !confirm(t('bulk.delete_confirm', { count: bulkIds.length }))) return;
    bulkDelete({ accountId: activeAccountId, ids: bulkIds }, {
      onSuccess: () => {
        toast.success(t('bulk.deleted', { count: bulkIds.length }));
        setSelectedIds([]);
      },
      onError: (err) => toast.error(bulkErrorMessage(err)),
    });
  };

  const handleBulkReconcile = () => {
    if (!activeAccountId || bulkIds.length === 0) return;
    const upcomingIds = (transactions?.data ?? [])
      .filter(tx => bulkIds.includes(tx.id) && operationState(tx) === 'a_venir')
      .map(tx => tx.id);
    bulkUpdate({ 
      accountId: activeAccountId, 
      command: {
        ids: bulkIds, 
        data: { reconciled: true } 
      }
    }, {
      onSuccess: () => {
        if (upcomingIds.length > 0) setPointedFromUpcoming(prev => new Set([...prev, ...upcomingIds]));
        toast.success(t('bulk.reconciled', { count: bulkIds.length }));
        setSelectedIds([]);
      },
      onError: (err) => toast.error(bulkErrorMessage(err)),
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
        {/* Hors mode compact, le titre de l'écran est celui de l'en-tête (un seul titre par écran). */}
        {compact && (
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold">{t('title')}</h2>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {extraActions}
          <Button size={compact ? "icon-xs" : "sm"} variant={compact ? "ghost" : "default"} className="gap-2" onClick={() => setCreateTransactionDrawerOpen(true)} data-tour={compact ? 'add-transaction' : undefined}>
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
          stateFilter={stateFilter} onStateChange={handleStateChange} toPointCount={periodStats?.cardCount}
          minAmount={minAmount} setMinAmount={setMinAmount}
          maxAmount={maxAmount} setMaxAmount={setMaxAmount}
          startDate={startDate} setStartDate={setStartDate}
          endDate={endDate} setEndDate={setEndDate}
          effectivePeriodId={effectivePeriodId || 'all'} setSelectedPeriodId={setSelectedPeriodId}
          periods={periods} periodId={periodId} periodControlled={period !== undefined}
          onApply={handleApplyFilters} onReset={handleResetFilters}
          t={t}
        />
      )}

      {!compact && effectivePeriodId === 'all' && (
        <p data-testid="all-periods-note" className="text-xs text-muted-foreground shrink-0">{t('all_periods_note')}</p>
      )}

      {isError && (
        <div role="alert" data-testid="list-error" className="flex flex-col items-start gap-3 rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">{t('list_error')}</p>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>{t('back_to_full_list')}</Button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {transactions && (
          <>
            <TransactionMobileList 
              transactions={transactions.data}
              categories={categories} tags={tags}
              selectedIds={selectedIds} onToggleSelect={toggleSelect}
              onEdit={setEditingTransaction} onTogglePointage={togglePointage}
              onTagClick={setTagDetailId} compact={compact} isUpdating={isUpdating} anomalyMarks={marks} t={t}
            />
            <TransactionTable 
              transactions={transactions.data}
              categories={categories} tags={tags}
              selectedIds={selectedIds} onToggleSelect={toggleSelect} onToggleSelectAll={toggleSelectAll}
              onEdit={setEditingTransaction} onDelete={handleDelete} onTogglePointage={togglePointage}
              onMakeRecurring={setTransactionToMakeRecurring} onTagClick={setTagDetailId}
              compact={compact} isUpdating={isUpdating} anomalyMarks={marks} t={t}
            />
          </>
        )}
      </div>

      {!compact && transactions && transactions.meta.totalPages >= 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t bg-muted/5 rounded-b-xl mt-4 gap-4">
          <div className="flex items-center gap-6">
            <div className="text-[10px] max-lg:text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
              {transactions.meta.total} {t('title').toLowerCase()}
            </div>
            {/* Limit Selector could be extracted too but it's small */}
          </div>

          <Pagination aria-label={t('pagination')} className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  label={tc('back')}
                  className={cn("h-8 text-[10px] max-lg:text-xs font-bold uppercase tracking-widest cursor-pointer", transactions.meta.page === 1 && "pointer-events-none opacity-50")}
                  onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }}
                />
              </PaginationItem>
              {generatePageNumbers().map((p, i) => (
                <PaginationItem key={i}>
                  {p === 'ellipsis' ? <PaginationEllipsis label={t('more_pages')} /> : (
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
                  label={tc('next')}
                  className={cn("h-8 text-[10px] max-lg:text-xs font-bold uppercase tracking-widest cursor-pointer", (transactions.meta.page === transactions.meta.totalPages || transactions.meta.totalPages === 0) && "pointer-events-none opacity-50")}
                  onClick={(e) => { e.preventDefault(); setPage(p => Math.min(transactions.meta.totalPages, p + 1)); }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <BulkActionsBar 
        selectedCount={bulkIds.length}
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
            amount: centsToInputString(BigInt(transactionToMakeRecurring.amount), locale),
            categoryId: transactionToMakeRecurring.categoryId || '',
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
  const locale = useLocale();
  const { activeAccountId } = useAccountStore();
  const { mutate: updateTransaction, isPending } = useUpdateTransaction();

  const handleSubmit = (values: TransactionFormValues) => {
    if (!activeAccountId) return;
    if (isUnreadableAmount(values.amount)) {
      toast.error(tc('invalid_amount'));
      return;
    }
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
          <SheetTitle>{t('edit_title')}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          <TransactionForm 
            accountId={activeAccountId}
            initialValues={{
              date: transaction.date.split('T')[0],
              description: transaction.description,
              categoryId: transaction.categoryId || '',
              tagIds: transaction.tagIds || [],
              amount: centsToInputString(BigInt(transaction.amount), locale),
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
