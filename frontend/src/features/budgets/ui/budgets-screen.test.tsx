import { cleanup, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { BudgetsScreen } from './budgets-screen';

const breakdown = {
  expenses: [
    { categoryId: 'e1', name: 'Loisirs', real: '-3000', budget: '10000', remaining: '7000', percentage: 30 },
    { categoryId: 'e2', name: 'Courses', real: '-60000', budget: '50000', remaining: '-10000', percentage: 120 },
    { categoryId: 'e3', name: 'Cadeaux', real: '0', budget: '0', remaining: '0', percentage: 0 },
  ],
  income: [{ categoryId: 'i1', name: 'Salaire', real: '260000', budget: '250000', remaining: '-10000', percentage: 104 }],
  savings: [{ categoryId: 's1', name: 'Livret', real: '-9000', budget: '10000', remaining: '1000', percentage: 90 }],
  transfers: [],
};
const stats = { forecastBalance: '123456', plannedIncome: '250000', plannedExpenses: '70000' };
const periods = [{ id: 'p0', startDate: '2026-10-01', endDate: '2026-10-31', isActive: false }];

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a', activePeriodId: 'p0', setActivePeriodId: vi.fn() }),
}));
vi.mock('../api/use-periods', () => ({ usePeriods: () => ({ data: periods }) }));
vi.mock('@/features/reporting/api/use-reporting-stats', () => ({ useReportingStats: () => ({ data: stats }) }));
vi.mock('@/features/reporting/api/use-budget-breakdown', () => ({
  useBudgetBreakdown: () => ({ data: breakdown, isLoading: false }),
}));

const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('BudgetsScreen', () => {
  afterEach(cleanup);
  const renderScreen = () =>
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <BudgetsScreen />
      </NextIntlClientProvider>,
    );

  it('shows forecast, planned income and total budgeted', () => {
    renderScreen();
    const text = nbsp(document.body.textContent!);
    expect(text).toContain('1 234,56 €');
    expect(text).toContain('2 500,00 €');
    expect(text).toContain('700,00 €');
  });

  it('lists fixed and variable categories in one sorted list, overruns first', () => {
    renderScreen();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      'Courses',
      'Livret',
      'Loisirs',
      'Cadeaux',
      'Salaire',
    ]);
  });

  it('shows the overrun amount of an overspent line, same figure as the Today block', () => {
    renderScreen();
    expect(nbsp(screen.getByTestId('over-budget').textContent!)).toContain('100,00 €');
  });

  it('does not show an income above its budget as an overrun', () => {
    renderScreen();
    const salaire = screen.getAllByRole('row').find((r) => r.textContent!.includes('Salaire'))!;
    expect(within(salaire).queryByTestId('over-budget')).toBeNull();
  });

  it('warns about a closed period', () => {
    renderScreen();
    expect(screen.getByTestId('closed-period-warning')).toBeTruthy();
  });
});
