import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { TransactionList } from './transaction-list';

const useTransactions = vi.fn();
const bulkDelete = vi.fn();
const bulkUpdate = vi.fn();

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1', activePeriodId: null }),
}));
vi.mock('@/shared/model/use-ui-store', () => ({
  useUiStore: () => ({
    setTagDetailId: vi.fn(),
    isCreateTransactionDrawerOpen: false,
    setCreateTransactionDrawerOpen: vi.fn(),
  }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({ usePeriods: () => ({ data: [] }) }));
vi.mock('@/features/categories/api/use-categories', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('@/features/tags/api/use-tags', () => ({ useTags: () => ({ data: [] }) }));
vi.mock('../api/use-transactions', () => ({
  useTransactions: (...args: unknown[]) => useTransactions(...args),
}));
vi.mock('../api/use-update-transaction', () => ({
  useUpdateTransaction: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../api/use-delete-transaction', () => ({ useDeleteTransaction: () => ({ mutate: vi.fn() }) }));
vi.mock('../api/use-bulk-transactions', () => ({
  useBulkUpdateTransactions: () => ({ mutate: bulkUpdate }),
  useBulkDeleteTransactions: () => ({ mutate: bulkDelete }),
}));
vi.mock('@/features/recurring/ui/create-recurring-dialog', () => ({ CreateRecurringDialog: () => null }));
vi.mock('./transaction-form', () => ({ TransactionForm: () => null }));
vi.mock('./transaction-table', () => ({
  TransactionTable: (p: { transactions: { id: string }[]; onToggleSelect: (id: string) => void }) => (
    <div>
      {p.transactions.map(tx => (
        <button key={tx.id} onClick={() => p.onToggleSelect(tx.id)}>{`select ${tx.id}`}</button>
      ))}
    </div>
  ),
}));
vi.mock('./transaction-mobile-list', () => ({ TransactionMobileList: () => null }));
vi.mock('./bulk-actions-bar', () => ({
  BulkActionsBar: ({ selectedCount, onBulkDelete, onBulkReconcile }: { selectedCount: number; onBulkDelete: () => void; onBulkReconcile: () => void }) =>
    selectedCount > 0 ? (
      <div data-testid="bulk-bar">
        {`count:${selectedCount}`}
        <button onClick={onBulkDelete}>bulk delete</button>
        <button onClick={onBulkReconcile}>bulk reconcile</button>
      </div>
    ) : null,
}));
vi.mock('./transaction-filters', () => ({
  TransactionFilters: (p: {
    setMinAmount: (v: string) => void;
    setMaxAmount: (v: string) => void;
    onApply: () => void;
  }) => (
    <div>
      <input aria-label="min" onChange={(e) => p.setMinAmount(e.target.value)} />
      <input aria-label="max" onChange={(e) => p.setMaxAmount(e.target.value)} />
      <button onClick={p.onApply}>apply</button>
    </div>
  ),
}));

function lastOptions() {
  return useTransactions.mock.calls.at(-1)![1];
}

describe('TransactionList amount filters', () => {
  beforeEach(() => {
    useTransactions.mockReset();
    useTransactions.mockReturnValue({ data: undefined, isLoading: false });
  });

  it('ignores an unreadable min/max instead of filtering on 0', () => {
    render(<TransactionList />);
    // "1e-5" is a valid number-input value that no amount parser can read
    fireEvent.change(screen.getByLabelText('min'), { target: { value: '1e-5' } });
    fireEvent.change(screen.getByLabelText('max'), { target: { value: '1e-5' } });
    fireEvent.click(screen.getByText('apply'));

    expect(lastOptions().minAmount).toBeUndefined();
    expect(lastOptions().maxAmount).toBeUndefined();
  });

  it('still applies a readable min/max', () => {
    render(<TransactionList />);
    fireEvent.change(screen.getByLabelText('min'), { target: { value: '10.50' } });
    fireEvent.change(screen.getByLabelText('max'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('apply'));

    expect(lastOptions().minAmount).toBe('1050');
    expect(lastOptions().maxAmount).toBe('2000');
  });
});

describe('TransactionList selection', () => {
  beforeEach(() => {
    useTransactions.mockReset();
    useTransactions.mockImplementation((_account: string, o: { page: number }) => ({
      data: {
        data: o.page === 1 ? [{ id: 'a' }, { id: 'b' }] : [{ id: 'c' }],
        meta: { page: o.page, totalPages: 2, total: 3, limit: 25 },
      },
      isLoading: false,
    }));
  });

  it('empties the selection and hides the bulk bar when the page changes', () => {
    render(<TransactionList />);
    fireEvent.click(screen.getByText('select a'));
    fireEvent.click(screen.getByText('select b'));
    expect(screen.getByTestId('bulk-bar').textContent).toContain('count:2');

    fireEvent.click(screen.getByText('2'));
    expect(screen.queryByTestId('bulk-bar')).toBeNull();

    // coming back to page 1 does not resurrect the old selection
    fireEvent.click(screen.getByText('1'));
    expect(screen.queryByTestId('bulk-bar')).toBeNull();
  });

  it('empties the selection when the filters change', () => {
    render(<TransactionList />);
    fireEvent.click(screen.getByText('select a'));
    expect(screen.getByTestId('bulk-bar')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('min'), { target: { value: '10' } });
    fireEvent.click(screen.getByText('apply'));
    expect(screen.queryByTestId('bulk-bar')).toBeNull();
  });

  it('keeps the selection while nothing changes', () => {
    render(<TransactionList />);
    fireEvent.click(screen.getByText('select a'));
    fireEvent.click(screen.getByText('select b'));
    fireEvent.click(screen.getByText('select b'));
    expect(screen.getByTestId('bulk-bar').textContent).toContain('count:1');
  });
});

describe('TransactionList bulk error toast', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    bulkDelete.mockReset();
    bulkUpdate.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.stubGlobal('confirm', () => true);
    useTransactions.mockReset();
    useTransactions.mockReturnValue({
      data: { data: [{ id: 'a' }], meta: { page: 1, totalPages: 1, total: 1, limit: 25 } },
      isLoading: false,
    });
  });

  function selectOneAndClick(label: string) {
    render(<TransactionList />);
    fireEvent.click(screen.getByText('select a'));
    fireEvent.click(screen.getByText(label));
  }

  it('shows the API message once when the bulk delete fails', () => {
    bulkDelete.mockImplementation((_vars, opts) =>
      opts.onError({ response: { data: { message: 'Transaction not found' } } }),
    );
    selectOneAndClick('bulk delete');

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('exact.transaction_not_found');
  });

  it('shows the generic message when the bulk update fails without an API message', () => {
    bulkUpdate.mockImplementation((_vars, opts) => opts.onError(new Error('Network Error')));
    selectOneAndClick('bulk reconcile');

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('error');
  });
});
