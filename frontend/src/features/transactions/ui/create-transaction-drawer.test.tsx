import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { CreateTransactionDrawer } from './create-transaction-drawer';

const createTransaction = vi.fn();
const createTransfer = vi.fn();
let formAmount = '';
let formDirection: 'expense' | 'income' | undefined;
let desktop = true;

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'fr' }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/shared/lib/use-is-desktop', () => ({ useIsDesktop: () => desktop }));
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
  useCreateTransfer: () => ({ mutate: createTransfer, isPending: false }),
}));
vi.mock('./transaction-form', () => ({
  TransactionForm: (p: { onSubmit: (v: unknown) => void; onAddAnother: (v: unknown) => void; onModeChange: (m: 'transfer') => void }) => {
    const values = {
      date: '2026-01-01', description: 'Test', categoryId: '', tagIds: [], amount: formAmount, pending: false,
      direction: formDirection, destinationAccountId: 'acc-2',
    };
    return (
      <>
        <button onClick={() => p.onSubmit(values)}>submit</button>
        <button onClick={() => p.onAddAnother(values)}>another</button>
        <button onClick={() => p.onModeChange('transfer')}>to-transfer</button>
      </>
    );
  },
}));

beforeEach(() => {
  createTransaction.mockReset();
  createTransfer.mockReset();
  vi.mocked(toast.error).mockReset();
  desktop = true;
  formDirection = undefined;
});

describe('CreateTransactionDrawer amount (bureau, signe tapé)', () => {
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

  it('desktop keeps sending a zero amount', () => {
    formAmount = '0';
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));
    expect(createTransaction.mock.calls[0][0].amount).toBe('0');
  });

  it('still rounds on desktop (1,005 -> 101): only the mobile entry refuses', () => {
    formAmount = '1,005';
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));
    expect(createTransaction.mock.calls[0][0].amount).toBe('101');
  });
});

describe('CreateTransactionDrawer amount (mobile, sens Dépense/Revenu)', () => {
  beforeEach(() => {
    desktop = false;
  });

  it.each([
    ['12,50', 'expense', '-1250'],
    ['12,50', 'income', '1250'],
    ['-12,50', 'expense', '-1250'],
    ['-12,50', 'income', '1250'],
  ] as const)('%s + %s -> %s', (amount, direction, expected) => {
    formAmount = amount;
    formDirection = direction;
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));
    expect(createTransaction.mock.calls[0][0].amount).toBe(expected);
  });

  it('defaults to expense when the form gives no direction', () => {
    formAmount = '12,50';
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));
    expect(createTransaction.mock.calls[0][0].amount).toBe('-1250');
  });

  it.each([
    ['abc', 'invalid_amount'],
    ['1,005', 'amount_too_many_decimals'],
    ['10000000000', 'amount_too_large'],
    ['0', 'amount_zero'],
    ['0,00', 'amount_zero'],
  ])('%s : message %s, rien envoyé, verrou non posé', (amount, message) => {
    formAmount = amount;
    const { rerender } = render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));
    expect(createTransaction).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(message);

    formAmount = '1,05';
    rerender(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(createTransaction.mock.calls[0][0].amount).toBe('-105');
  });

  it('virement : valeur absolue, sens sans effet', () => {
    formAmount = '-12,50';
    formDirection = 'income';
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('to-transfer'));
    fireEvent.click(screen.getByText('submit'));
    expect(createTransfer.mock.calls[0][0].amount).toBe('1250');
  });
});

describe('CreateTransactionDrawer envoi unique', () => {
  beforeEach(() => {
    formAmount = '12,50';
  });

  it('deux clics sur « Ajouter » pendant l\'envoi : un seul envoi', () => {
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));
    fireEvent.click(screen.getByText('submit'));
    expect(createTransaction).toHaveBeenCalledTimes(1);
  });

  it('« Ajouter et en saisir une autre » puis « Ajouter » immédiat : un seul envoi', () => {
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('another'));
    fireEvent.click(screen.getByText('submit'));
    expect(createTransaction).toHaveBeenCalledTimes(1);
  });

  it('le même verrou couvre le virement', () => {
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('to-transfer'));
    fireEvent.click(screen.getByText('submit'));
    fireEvent.click(screen.getByText('another'));
    expect(createTransfer).toHaveBeenCalledTimes(1);
  });

  it('erreur serveur : le verrou est libéré, un nouvel appui envoie', () => {
    createTransaction.mockImplementation((_cmd, opts) => opts.onSettled());
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));
    fireEvent.click(screen.getByText('submit'));
    expect(createTransaction).toHaveBeenCalledTimes(2);
  });

  it('succès : le verrou est libéré aussi', () => {
    createTransaction.mockImplementation((_cmd, opts) => {
      opts.onSuccess();
      opts.onSettled();
    });
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('another'));
    fireEvent.click(screen.getByText('another'));
    expect(createTransaction).toHaveBeenCalledTimes(2);
  });
});

describe('CreateTransactionDrawer period switch message', () => {
  it('tells the closed and opened periods when the created transaction switched', () => {
    formAmount = '2000';
    createTransaction.mockImplementation((_v, o) =>
      o.onSuccess({
        id: 't1',
        periodSwitch: {
          closed: { id: 'p1', startDate: '2026-10-01', endDate: '2026-11-27' },
          opened: { id: 'p2', startDate: '2026-11-28', endDate: '2026-12-27' },
          count: 1,
          dateChanged: false,
        },
      }),
    );
    vi.mocked(toast.success).mockReset();
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));

    expect(toast.success).toHaveBeenCalledWith('period_switch', undefined);
  });

  it('keeps the usual message only when nothing switched', () => {
    formAmount = '2000';
    createTransaction.mockImplementation((_v, o) => o.onSuccess({ id: 't1' }));
    vi.mocked(toast.success).mockReset();
    render(<CreateTransactionDrawer />);
    fireEvent.click(screen.getByText('submit'));

    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
