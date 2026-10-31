import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { CreateTransactionDrawer } from './create-transaction-drawer';

const createTransaction = vi.fn();
let formAmount = '';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1' }),
}));
vi.mock('@/shared/model/use-ui-store', () => ({
  useUiStore: () => ({
    isCreateTransactionDrawerOpen: true,
    setCreateTransactionDrawerOpen: vi.fn(),
  }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({ usePeriods: () => ({ data: [] }) }));
vi.mock('../api/use-create-transaction', () => ({
  useCreateTransaction: () => ({ mutate: createTransaction, isPending: false }),
}));
vi.mock('../api/use-create-transfer', () => ({
  useCreateTransfer: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('./transaction-form', () => ({
  TransactionForm: (p: { onSubmit: (v: unknown) => void }) => (
    <button
      onClick={() =>
        p.onSubmit({ date: '2026-01-01', description: 'Test', categoryId: '', tagIds: [], amount: formAmount, pending: false })
      }
    >
      submit
    </button>
  ),
}));

describe('CreateTransactionDrawer amount', () => {
  beforeEach(() => {
    createTransaction.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('blocks the submission and shows an error when the amount is unreadable', () => {
    formAmount = '1e-5';
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));

    expect(createTransaction).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('invalid_amount');
  });

  it('sends a readable amount in cents', () => {
    formAmount = '-12,50';
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));

    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(createTransaction.mock.calls[0][0].amount).toBe('-1250');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
