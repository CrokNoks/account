import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BudgetBreakdown } from './budget-breakdown';

const breakdown = {
  expenses: [
    { categoryId: 'e1', name: 'Courses', real: '-60000', budget: '50000', remaining: '-10000', percentage: 120 },
    { categoryId: 'e2', name: 'Loisirs', real: '-3000', budget: '10000', remaining: '7000', percentage: 30 },
    { categoryId: 'e3', name: 'Imprévus', real: '-2000', budget: '0', remaining: '-2000', percentage: 0 },
    { categoryId: 'e4', name: 'Cadeaux', real: '0', budget: '0', remaining: '0', percentage: 0 },
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
    expect(over).toHaveLength(2); // Courses and Imprévus on the default tab
    expect(nbsp(over[0].textContent!)).toBe('over_budget_expense(100,00 €)');
    expect(screen.getAllByText(/remaining/)[0].textContent).toContain('70,00');
  });

  it('shows a full red bar for an expense spent without any budget', () => {
    render(<BudgetBreakdown />);
    const bar = screen.getAllByTestId('budget-bar')[2]; // Imprévus: 20 spent on 0
    expect(bar.className).toContain('bg-red-500');
    expect(bar.style.width).toBe('100%');
  });

  it('keeps an empty bar when nothing is spent and nothing is budgeted', () => {
    render(<BudgetBreakdown />);
    const bar = screen.getAllByTestId('budget-bar')[3]; // Cadeaux: 0 on 0
    expect(bar.style.width).toBe('0%');
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

  it('une dépense remboursée (réel positif) est un excédent : 0,00 €, barre vide, ni rouge ni dépassement', () => {
    const saved = breakdown.expenses;
    breakdown.expenses = [
      { categoryId: 'r1', name: 'Imprévus', real: '3462', budget: '0', remaining: '3462', percentage: 0 },
    ];
    render(<BudgetBreakdown />);
    const bar = screen.getByTestId('budget-bar');
    expect(bar.className).not.toContain('bg-red-500');
    expect(bar.style.width).toBe('0%');
    expect(screen.queryByTestId('over-budget')).toBeNull();
    expect(nbsp(screen.getByTestId('surplus').textContent!)).toBe('surplus_expense(34,62 €)');
    expect(nbsp(document.body.textContent!)).toContain('0,00 € / 0,00 €');
    expect(nbsp(document.body.textContent!)).not.toContain('34,62 € / 0,00 €');
    breakdown.expenses = saved;
  });

  it('excédent avec budget : +50 € sur un budget de 100 € reste un excédent, 0 %, barre vide', () => {
    const saved = breakdown.expenses;
    breakdown.expenses = [
      { categoryId: 'r2', name: 'Santé', real: '5000', budget: '10000', remaining: '15000', percentage: -50 },
    ];
    render(<BudgetBreakdown />);
    expect(screen.getByTestId('budget-bar').style.width).toBe('0%');
    expect(nbsp(document.body.textContent!)).toContain('0,00 € / 100,00 €');
    expect(nbsp(screen.getByTestId('surplus').textContent!)).toBe('surplus_expense(50,00 €)');
    expect(document.body.textContent).toContain('0%');
    breakdown.expenses = saved;
  });
});
