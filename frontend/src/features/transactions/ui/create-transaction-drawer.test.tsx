import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { CreateTransactionDrawer } from './create-transaction-drawer';

const createTransaction = vi.fn();
const scanReceipt = vi.fn();
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
vi.mock('@/features/reporting/api/use-scan-receipt', () => ({
  useScanReceipt: () => ({ mutate: scanReceipt, isPending: false }),
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

describe('CreateTransactionDrawer receipt scan error', () => {
  beforeEach(() => {
    scanReceipt.mockReset();
    vi.mocked(toast.error).mockReset();
    // Minimal browser doubles so the scan pipeline reaches the mutation call.
    vi.stubGlobal('FileReader', class {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      readAsDataURL() { this.onload?.({ target: { result: 'data:image/png;base64,AAAA' } }); }
    });
    vi.stubGlobal('Image', class {
      width = 10;
      height = 10;
      onload: (() => void) | null = null;
      set src(_value: string) { this.onload?.(); }
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
  });

  afterEach(() => vi.unstubAllGlobals());

  function scan() {
    const { container } = render(<CreateTransactionDrawer />);
    const input = container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'ticket.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
  }

  it('shows the message returned by the API when the scan fails', () => {
    scanReceipt.mockImplementation((_vars, opts) =>
      opts.onError({ response: { data: { message: 'Image trop volumineuse' } } }),
    );
    scan();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('Image trop volumineuse');
  });

  it('falls back to the translated message when the API gave none', () => {
    scanReceipt.mockImplementation((_vars, opts) => opts.onError(new Error('Network Error')));
    scan();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('scan.error');
  });
});
