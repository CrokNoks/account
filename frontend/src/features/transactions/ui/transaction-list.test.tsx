import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { TransactionList } from './transaction-list';

const useTransactions = vi.fn();
const bulkDelete = vi.fn();
const bulkUpdate = vi.fn();
const update = vi.fn();
const stats = vi.hoisted(() => ({ cardCount: 7 as number | undefined }));

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
vi.mock('@/features/reporting/api/use-anomalies', () => ({ useAnomalies: () => ({ data: [] }) }));
vi.mock('@/features/reporting/api/use-reporting-stats', () => ({
  useReportingStats: () => ({ data: stats.cardCount === undefined ? undefined : { cardCount: stats.cardCount } }),
}));
vi.mock('@/features/tags/api/use-tags', () => ({ useTags: () => ({ data: [] }) }));
vi.mock('../api/use-transactions', () => ({
  useTransactions: (...args: unknown[]) => useTransactions(...args),
}));
vi.mock('../api/use-update-transaction', () => ({
  useUpdateTransaction: () => ({ mutate: update, isPending: false }),
}));
vi.mock('../api/use-delete-transaction', () => ({ useDeleteTransaction: () => ({ mutate: vi.fn() }) }));
vi.mock('../api/use-bulk-transactions', () => ({
  useBulkUpdateTransactions: () => ({ mutate: bulkUpdate }),
  useBulkDeleteTransactions: () => ({ mutate: bulkDelete }),
}));
vi.mock('@/features/recurring/ui/create-recurring-dialog', () => ({ CreateRecurringDialog: () => null }));
vi.mock('./transaction-form', () => ({ TransactionForm: () => null }));
vi.mock('./transaction-table', () => ({
  TransactionTable: (p: { transactions: { id: string }[]; onToggleSelect: (id: string) => void; onTogglePointage: (tx: { id: string }) => void }) => (
    <div>
      {p.transactions.map(tx => (
        <span key={tx.id}>
          <button onClick={() => p.onToggleSelect(tx.id)}>{`select ${tx.id}`}</button>
          <button onClick={() => p.onTogglePointage(tx)}>{`point ${tx.id}`}</button>
        </span>
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
    stateFilter: string;
    onStateChange: (v: string) => void;
    toPointCount?: number;
  }) => (
    <div>
      <span data-testid="state">{p.stateFilter}</span>
      <span data-testid="count">{String(p.toPointCount)}</span>
      {['all', 'a_pointer', 'a_venir', 'pointee'].map(v => (
        <button key={v} onClick={() => p.onStateChange(v)}>{`state ${v}`}</button>
      ))}
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

describe('TransactionList period', () => {
  beforeEach(() => {
    useTransactions.mockReset();
    useTransactions.mockReturnValue({ data: undefined, isLoading: false });
  });

  it('starts on the period chosen by the screen', () => {
    render(<TransactionList period="p1" />);
    expect(lastOptions().periodId).toBe('p1');
  });

  it('sends no period for « all periods »', () => {
    render(<TransactionList period="all" />);
    expect(lastOptions().periodId).toBeUndefined();
  });
});

describe('TransactionList filters from a link', () => {
  beforeEach(() => {
    useTransactions.mockReset();
    useTransactions.mockReturnValue({ data: undefined, isLoading: false });
  });

  it('starts filtered on the exact ids and the category of the link', () => {
    render(<TransactionList initialFilters={{ ids: ['t1', 't2'], categoryId: 'cat-1' }} />);
    expect(lastOptions().ids).toBe('t1,t2');
    expect(lastOptions().categoryId).toBe('cat-1');
  });

  it('sends no ids without a link', () => {
    render(<TransactionList />);
    expect(lastOptions().ids).toBeUndefined();
  });
});

describe('TransactionList state filter', () => {
  beforeEach(() => {
    useTransactions.mockReset();
    useTransactions.mockReturnValue({ data: undefined, isLoading: false });
    stats.cardCount = 7;
  });

  it.each([
    ['a_pointer', { reconciled: false, pending: false }],
    ['a_venir', { reconciled: false, pending: true }],
  ])('« %s » sends reconciled and pending', (state, expected) => {
    render(<TransactionList />);
    fireEvent.click(screen.getByText(`state ${state}`));
    expect(lastOptions()).toMatchObject(expected);
  });

  it('« pointee » sends reconciled true and no pending (the reconciled pending stays in)', () => {
    render(<TransactionList />);
    fireEvent.click(screen.getByText('state pointee'));
    expect(lastOptions().reconciled).toBe(true);
    expect('pending' in lastOptions()).toBe(false);
  });

  it('« all » sends neither', () => {
    render(<TransactionList />);
    fireEvent.click(screen.getByText('state a_pointer'));
    fireEvent.click(screen.getByText('state all'));
    expect(lastOptions().reconciled).toBeUndefined();
    expect(lastOptions().pending).toBeUndefined();
  });

  it('combines with the other filters', () => {
    render(<TransactionList initialFilters={{ categoryId: 'cat-1' }} />);
    fireEvent.change(screen.getByLabelText('min'), { target: { value: '10' } });
    fireEvent.click(screen.getByText('apply'));
    fireEvent.click(screen.getByText('state a_pointer'));
    expect(lastOptions()).toMatchObject({ reconciled: false, pending: false, categoryId: 'cat-1', minAmount: '1000' });
  });

  it('starts on « a_pointer » when the link says so (CB link of À traiter)', () => {
    render(<TransactionList initialFilters={{ state: 'a_pointer' }} />);
    expect(screen.getByTestId('state').textContent).toBe('a_pointer');
    expect(lastOptions()).toMatchObject({ reconciled: false, pending: false });
  });

  it('gives the filter the count to point of the period', () => {
    render(<TransactionList />);
    expect(screen.getByTestId('count').textContent).toBe('7');
  });
});

describe('TransactionList all periods', () => {
  beforeEach(() => {
    useTransactions.mockReset();
    useTransactions.mockReturnValue({ data: undefined, isLoading: false });
  });

  it('says the count and the marks only cover the chosen period', () => {
    render(<TransactionList period="all" />);
    expect(screen.getByTestId('all-periods-note')).toBeTruthy();
  });

  it('shows no such note on a period', () => {
    render(<TransactionList period="p1" />);
    expect(screen.queryByTestId('all-periods-note')).toBeNull();
  });
});

describe('TransactionList pointing', () => {
  const row = (id: string, reconciled: boolean, pending: boolean) => ({ id, reconciled, pending });
  let rows: ReturnType<typeof row>[];
  const ui = () => <TransactionList />;

  beforeEach(() => {
    update.mockReset();
    bulkUpdate.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.info).mockReset();
    rows = [row('cb', false, false), row('fa', false, true), row('ok', true, false)];
    useTransactions.mockReset();
    useTransactions.mockImplementation(() => ({
      data: { data: rows, meta: { page: 1, totalPages: 1, total: rows.length, limit: 25 } },
      isLoading: false,
    }));
  });

  it('points a CB in one gesture, with no action message', () => {
    update.mockImplementation((_v, o) => o.onSuccess());
    render(ui());
    fireEvent.click(screen.getByText('point cb'));

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 'cb', data: { reconciled: true } }), expect.anything());
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('unpointing a line pointed from « Facture à venir » in this session offers to put it back', () => {
    update.mockImplementation((_v, o) => o.onSuccess());
    const { rerender } = render(ui());
    fireEvent.click(screen.getByText('point fa'));
    rows = [row('cb', false, false), row('fa', true, false), row('ok', true, false)];
    rerender(ui());
    fireEvent.click(screen.getByText('point fa')); // unpoint

    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'fa', data: { reconciled: false } }), expect.anything());
    const [message, options] = vi.mocked(toast.info).mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
    expect(message).toBe('unpointed_to_point');
    expect(options.action.label).toBe('back_to_upcoming');

    rows = [row('cb', false, false), row('fa', false, false), row('ok', true, false)];
    options.action.onClick();
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'fa', data: { pending: true } }), expect.anything());
  });

  it('unpointing a line pointed before the session (or a CB) gives no message and no action', () => {
    update.mockImplementation((_v, o) => o.onSuccess());
    render(ui());
    fireEvent.click(screen.getByText('point ok'));

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 'ok', data: { reconciled: false } }), expect.anything());
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('toggled');
  });

  it('a failed pointing is not remembered: no success message, no action afterwards', () => {
    update.mockImplementation(() => undefined); // network error: onSuccess never called
    const { rerender } = render(ui());
    fireEvent.click(screen.getByText('point fa'));
    expect(toast.success).not.toHaveBeenCalled();

    update.mockImplementation((_v, o) => o.onSuccess());
    rows = [row('cb', false, false), row('fa', true, false), row('ok', true, false)];
    rerender(ui());
    fireEvent.click(screen.getByText('point fa'));
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('a bulk pointing remembers the invoices to come it pointed', () => {
    bulkUpdate.mockImplementation((_v, o) => o.onSuccess());
    update.mockImplementation((_v, o) => o.onSuccess());
    const { rerender } = render(ui());
    fireEvent.click(screen.getByText('select fa'));
    fireEvent.click(screen.getByText('bulk reconcile'));
    rows = [row('cb', false, false), row('fa', true, false), row('ok', true, false)];
    rerender(ui());
    fireEvent.click(screen.getByText('point fa'));

    expect(toast.info).toHaveBeenCalledTimes(1);
  });
});

describe('TransactionList en erreur (ids invalides : 400 du back)', () => {
  it('affiche un message clair et revient à la liste complète, sans identifiants', () => {
    useTransactions.mockReset();
    useTransactions.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<TransactionList initialFilters={{ ids: ['pas-un-uuid'] }} />);

    expect(screen.getByTestId('list-error')).toHaveTextContent('list_error');
    expect(lastOptions().ids).toBe('pas-un-uuid');

    fireEvent.click(screen.getByText('back_to_full_list'));
    expect(lastOptions().ids).toBeUndefined();
  });
});
