import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { BudgetsToWatch } from './budgets-to-watch';

const state = vi.hoisted(() => ({
  breakdown: undefined as unknown,
  periods: [{ id: 'p1', startDate: '2026-11-01', endDate: '2026-11-30', isActive: true }],
}));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({ usePeriods: () => ({ data: state.periods }) }));
vi.mock('../api/use-budget-breakdown', () => ({
  useBudgetBreakdown: () => ({ isLoading: false, data: state.breakdown }),
}));

const line = (name: string, real: string, budget: string) => ({
  categoryId: name,
  name,
  real,
  budget,
  remaining: '0',
  percentage: 0,
});

const renderIt = () =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <BudgetsToWatch />
    </NextIntlClientProvider>,
  );

describe('Budgets à surveiller', () => {
  afterEach(() => vi.useRealTimers());

  it('affiche 5 lignes au plus, dépassés en tête, avec le repère de période écoulée', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15, 12));
    state.breakdown = {
      income: [],
      transfers: [],
      savings: [],
      expenses: ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => line(n, String(-1000 * (i + 1)), '10000')),
    };
    renderIt();
    const rows = screen.getAllByTestId('watch-row');
    expect(rows).toHaveLength(5);
    expect(rows[0].textContent).toContain('F');
    const marker = screen.getAllByTestId('watch-marker')[0];
    expect(marker.style.left).toBe('50%');
  });

  it('sans fin de période, pas de repère ; sans budget, un message', () => {
    state.periods = [{ id: 'p1', startDate: '2026-11-01', endDate: null as unknown as string, isActive: true }];
    state.breakdown = { income: [], transfers: [], savings: [], expenses: [line('A', '-1000', '10000')] };
    renderIt();
    expect(screen.queryByTestId('watch-marker')).toBeNull();
  });

  it('une ligne dépassée est rouge et sa barre ne dépasse pas 100 %', () => {
    state.breakdown = { income: [], transfers: [], savings: [], expenses: [line('A', '-15000', '10000')] };
    renderIt();
    const bar = screen.getByTestId('watch-bar');
    expect(bar.className).toContain('bg-red-500');
    expect(bar.style.width).toBe('100%');
  });
});
