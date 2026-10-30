import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionList } from './transaction-list';

const useTransactions = vi.fn();

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
  useBulkUpdateTransactions: () => ({ mutate: vi.fn() }),
  useBulkDeleteTransactions: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/recurring/ui/create-recurring-dialog', () => ({ CreateRecurringDialog: () => null }));
vi.mock('./transaction-form', () => ({ TransactionForm: () => null }));
vi.mock('./transaction-table', () => ({ TransactionTable: () => null }));
vi.mock('./transaction-mobile-list', () => ({ TransactionMobileList: () => null }));
vi.mock('./bulk-actions-bar', () => ({ BulkActionsBar: () => null }));
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
