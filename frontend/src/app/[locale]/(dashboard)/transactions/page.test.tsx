import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionsPage from './page';

const state = vi.hoisted(() => ({
  periods: [] as Array<{ id: string; startDate: string; endDate: string; isActive: boolean }>,
  activePeriodId: 'p1' as string | null,
  setActivePeriodId: vi.fn(),
  listPeriod: undefined as string | undefined,
  hasPeriod: undefined as boolean | undefined,
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/i18n/routing', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: state.activePeriodId, setActivePeriodId: state.setActivePeriodId }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({ usePeriods: () => ({ data: state.periods }) }));
vi.mock('@/shared/model/use-ui-store', () => ({ useUiStore: () => ({ startTour: vi.fn(), completedTours: {} }) }));
vi.mock('@/shared/ui/tour/HelpButton', () => ({ HelpButton: () => null }));
vi.mock('@/features/transactions/ui/operations-balances', () => ({
  OperationsBalances: ({ hasPeriod }: { hasPeriod: boolean }) => {
    state.hasPeriod = hasPeriod;
    return null;
  },
}));
vi.mock('@/features/transactions/ui/transaction-list', () => ({
  TransactionList: ({ period }: { period?: string }) => {
    state.listPeriod = period;
    return null;
  },
}));
vi.mock('@/features/periods/ui/period-select', () => ({
  ALL_PERIODS: 'all',
  PeriodSelect: ({ onChange }: { onChange: (v: string) => void }) => (
    <>
      <button onClick={() => onChange('all')}>pick all</button>
      <button onClick={() => onChange('p0')}>pick p0</button>
    </>
  ),
}));

describe('Page Opérations', () => {
  beforeEach(() => {
    state.periods = [
      { id: 'p1', startDate: '2026-11-01', endDate: '2026-11-30', isActive: true },
      { id: 'p0', startDate: '2026-10-01', endDate: '2026-10-31', isActive: false },
    ];
    state.activePeriodId = 'p1';
    state.setActivePeriodId.mockReset();
  });

  it('démarre la liste sur la période choisie', () => {
    render(<TransactionsPage />);
    expect(state.listPeriod).toBe('p1');
    expect(state.hasPeriod).toBe(true);
  });

  it('« toutes les périodes » élargit la liste sans changer la période partagée avec Aujourd\'hui', () => {
    render(<TransactionsPage />);
    fireEvent.click(screen.getByText('pick all'));

    expect(state.listPeriod).toBe('all');
    expect(state.setActivePeriodId).not.toHaveBeenCalled();
  });

  it('choisir une période la partage avec le reste de l\'application', () => {
    render(<TransactionsPage />);
    fireEvent.click(screen.getByText('pick p0'));

    expect(state.setActivePeriodId).toHaveBeenCalledWith('p0');
  });

  it('sans période : liste sur toutes les périodes et soldes remplacés par une explication', () => {
    state.periods = [];
    state.activePeriodId = null;
    render(<TransactionsPage />);

    expect(state.listPeriod).toBe('all');
    expect(state.hasPeriod).toBe(false);
  });
});
