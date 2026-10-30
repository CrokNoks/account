import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BudgetBreakdown } from './budget-breakdown';

const breakdown = {
  expenses: [
    { categoryId: 'e1', name: 'Courses', real: '-60000', budget: '50000', remaining: '-10000', percentage: 120 },
    { categoryId: 'e2', name: 'Loisirs', real: '-3000', budget: '10000', remaining: '7000', percentage: 30 },
  ],
  income: [
    { categoryId: 'i1', name: 'Salaire', real: '260000', budget: '250000', remaining: '-10000', percentage: 104 },
  ],
  savings: [],
  transfers: [],
};

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}(${values.amount})` : key,
}));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a', activePeriodId: 'p' }),
}));
vi.mock('../api/use-budget-breakdown', () => ({
  useBudgetBreakdown: () => ({ data: breakdown, isLoading: false }),
}));

const nbsp = (s: string) => s.replace(/[  ]/g, ' ');

describe('BudgetBreakdown overrun', () => {
  it('shows an expense above its budget as an overrun, not as a remaining amount', () => {
    render(<BudgetBreakdown />);
    const over = screen.getAllByTestId('over-budget');
    expect(over).toHaveLength(1); // only the overspent expense on the default tab
    expect(nbsp(over[0].textContent!)).toBe('over_budget_expense(100,00 €)');
    expect(screen.getByText(/remaining/).textContent).toContain('70,00');
  });

  it('colours an expense bar red only when the budget is exceeded', () => {
    render(<BudgetBreakdown />);
    const bars = screen.getAllByTestId('budget-bar');
    expect(bars[0].className).toContain('bg-red-500'); // Courses: 600 spent on 500
    expect(bars[1].className).toContain('bg-green-500'); // Loisirs: 30 spent on 100
  });

  it('shows an income above its budget as beyond budget', () => {
    render(<BudgetBreakdown />);
    const tab = screen.getByRole('tab', { name: 'income' });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    const over = screen.getAllByTestId('over-budget');
    expect(nbsp(over[0].textContent!)).toBe('over_budget_income(100,00 €)');
  });
});
