import { render, screen } from '@testing-library/react';
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
  savings: [] as Array<{ categoryId: string; name: string; real: string; budget: string; remaining: string; percentage: number }>,
  transfers: [],
};

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}(${values.amount})` : key,
  useLocale: () => 'fr',
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
    expect(over).toHaveLength(2); // Courses and Imprévus
    expect(nbsp(over[0].textContent!)).toBe('over_budget_expense(100,00 €)');
    expect(screen.getAllByText(/remaining/)[0].textContent).toContain('70,00');
  });

  it("écrit le pourcentage consommé au format de la langue (« 120 % », pas « 120% »)", () => {
    render(<BudgetBreakdown />);
    const text = nbsp(document.body.textContent!);
    expect(text).toContain('120 %');
    expect(text).not.toContain('120%');
  });

  it('shows a full orange bar for an expense spent without any budget', () => {
    render(<BudgetBreakdown />);
    const bar = screen.getAllByTestId('budget-bar')[2]; // Imprévus: 20 spent on 0
    expect(bar.className).toContain('bg-warn');
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
    expect(bars[0].className).toContain('bg-warn'); // Courses: 600 spent on 500
    expect(bars[1].className).toContain('bg-primary'); // Loisirs: 30 spent on 100
  });

  it('« Budgets variables » : catégories de dépense seules, sans onglets ; revenus, épargne et virements absents', () => {
    breakdown.savings = [{ categoryId: 's1', name: 'Livret', real: '-5000', budget: '10000', remaining: '5000', percentage: 50 }];
    render(<BudgetBreakdown />);
    expect(screen.getByText('variable_budgets')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    const text = document.body.textContent!;
    for (const name of ['Courses', 'Loisirs', 'Imprévus', 'Cadeaux']) expect(text).toContain(name);
    for (const name of ['Salaire', 'Livret']) expect(text).not.toContain(name);
    expect(screen.getAllByTestId('budget-bar')).toHaveLength(4);
    breakdown.savings = [];
  });

  it('figé : montants réel / budget en valeur absolue et restant', () => {
    render(<BudgetBreakdown />);
    const text = nbsp(document.body.textContent!);
    expect(text).toContain('600,00 € / 500,00 €');
    expect(text).toContain('30,00 € / 100,00 €');
    expect(text).toContain('remaining: 70,00 €');
  });

  it('une dépense remboursée (réel positif) est un excédent : ni barre orange ni dépassement', () => {
    const saved = breakdown.expenses;
    breakdown.expenses = [
      { categoryId: 'r1', name: 'Impôts', real: '3462', budget: '0', remaining: '3462', percentage: 0 },
    ];
    render(<BudgetBreakdown />);
    const bar = screen.getByTestId('budget-bar');
    expect(bar.className).toContain('bg-primary');
    expect(bar.style.width).toBe('0%');
    expect(screen.queryByTestId('over-budget')).toBeNull();
    expect(nbsp(screen.getByTestId('surplus').textContent!)).toBe('surplus_expense(34,62 €)');
    expect(nbsp(document.body.textContent!)).not.toContain('34,62 € / 0,00 €');
    breakdown.expenses = saved;
  });

  it('excédent avec budget : réel net positif sur un budget de 100 € reste un excédent, barre vide', () => {
    const saved = breakdown.expenses;
    breakdown.expenses = [
      { categoryId: 'r2', name: 'Santé', real: '5000', budget: '10000', remaining: '15000', percentage: -50 },
    ];
    render(<BudgetBreakdown />);
    expect(screen.getByTestId('budget-bar').style.width).toBe('0%');
    expect(nbsp(screen.getByTestId('surplus').textContent!)).toBe('surplus_expense(50,00 €)');
    expect(screen.queryByTestId('over-budget')).toBeNull();
    breakdown.expenses = saved;
  });

  it('reste exact au-delà de 2^53 : montants, dépassement, restant et couleur de barre', () => {
    breakdown.expenses = [
      { categoryId: 'b1', name: 'Gros', real: '-9007199254740995', budget: '9007199254740994', remaining: '-1', percentage: 100 },
      { categoryId: 'b2', name: 'Pile', real: '-9007199254740994', budget: '9007199254740994', remaining: '0', percentage: 100 },
      { categoryId: 'b3', name: 'Reste', real: '-1', budget: '9007199254740993', remaining: '9007199254740992', percentage: 0 },
    ];
    render(<BudgetBreakdown />);
    const text = nbsp(document.body.textContent!);
    expect(text).toContain('90 071 992 547 409,95 € / 90 071 992 547 409,94 €');
    expect(text).toContain('over_budget_expense(0,01 €)');
    expect(text).toContain('remaining: 90 071 992 547 409,92 €');
    const bars = screen.getAllByTestId('budget-bar');
    expect(bars[0].className).toContain('bg-warn'); // 2^53+3 > 2^53+2 : indiscernable en flottant
    expect(bars[1].className).toContain('bg-primary'); // égaux : pas orange
  });
});
