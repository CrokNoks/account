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
    expect(bar.className).toContain('bg-warn');
    expect(bar.style.width).toBe('100%');
  });

  it('une dépense remboursée (réel positif) est un excédent : barre vide, jamais orange, 0,00 € consommé', () => {
    state.breakdown = {
      income: [], transfers: [], savings: [],
      expenses: [line('Santé', '5000', '10000'), line('Vide', '3462', '0')],
    };
    renderIt();
    const rows = screen.getAllByTestId('watch-row');
    expect(rows).toHaveLength(1);
    const bar = screen.getByTestId('watch-bar');
    expect(bar.className).toContain('bg-primary');
    expect(bar.style.width).toBe('0%');
    expect(rows[0].textContent!.replace(/[\u00a0\u202f]/g, ' ')).toContain('0,00 € / 100,00 €');
  });

  it('figé : montants réel / budget en valeur absolue', () => {
    state.breakdown = { income: [], transfers: [], savings: [], expenses: [line('A', '-15000', '10000')] };
    renderIt();
    expect(screen.getByTestId('watch-row').textContent!.replace(/[\u00a0\u202f]/g, ' ')).toContain('150,00 € / 100,00 €');
  });

  it('reste exact au-delà de 2^53 (texte et couleur)', () => {
    state.breakdown = { income: [], transfers: [], savings: [], expenses: [line('A', '-9007199254740995', '9007199254740994')] };
    renderIt();
    expect(screen.getByTestId('watch-row').textContent!.replace(/[\u00a0\u202f]/g, ' ')).toContain('90 071 992 547 409,95 € / 90 071 992 547 409,94 €');
    expect(screen.getByTestId('watch-bar').className).toContain('bg-warn');
  });
});
