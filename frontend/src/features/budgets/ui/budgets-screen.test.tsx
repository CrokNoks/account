import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
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
const periods = [
  { id: 'p0', startDate: '2026-10-01', endDate: '2026-10-31', isActive: false },
  { id: 'p1', startDate: '2026-11-01', endDate: '2026-11-30', isActive: true },
];
const saved = [
  { id: 'b1', categoryId: 'e1', amountAllocated: '10000' },
  { id: 'b2', categoryId: 'e2', amountAllocated: '50000' },
  { id: 'b3', categoryId: 's1', amountAllocated: '10000' },
  { id: 'b4', categoryId: 'i1', amountAllocated: '250000' },
];
const simResult = {
  forecastBalance: '100000',
  savedForecastBalance: '123456',
  delta: '-23456',
  incomeEffect: '0',
  expensesEffect: '-23456',
  plannedIncome: '250000',
  plannedExpenses: '93456',
  realIncome: '260000',
  realExpenses: '-72000',
};
const simState = { data: undefined as unknown, isStale: false, isError: false };
const simCalls: Array<{ budgets: Array<{ categoryId: string; amountAllocated: string }>; enabled: boolean }> = [];
const saveMock = vi.fn();
const setPeriod = vi.fn();
const toastSuccess = vi.fn();


vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a', activePeriodId: 'p0', setActivePeriodId: setPeriod }),
}));
vi.mock('../api/use-periods', () => ({ usePeriods: () => ({ data: periods }) }));
vi.mock('@/features/reporting/api/use-reporting-stats', () => ({ useReportingStats: () => ({ data: stats }) }));
vi.mock('@/features/reporting/api/use-budget-breakdown', () => ({
  useBudgetBreakdown: () => ({ data: breakdown, isLoading: false }),
}));
vi.mock('@/features/periods/api/use-period-budgets', () => ({ usePeriodBudgets: () => ({ data: saved }) }));
vi.mock('@/features/periods/api/use-update-period-budgets', () => ({
  useUpdatePeriodBudgets: () => ({ mutateAsync: saveMock, isPending: false }),
}));
vi.mock('../api/use-forecast-simulation', () => ({
  useForecastSimulation: (p: { budgets: never[]; enabled: boolean }) => {
    simCalls.push({ budgets: p.budgets, enabled: p.enabled });
    return p.enabled ? simState : { data: undefined, isStale: false, isError: false };
  },
}));
vi.mock('@/features/periods/ui/period-select', () => ({
  PeriodSelect: ({ onChange }: { onChange: (v: string) => void }) => (
    <button data-testid="pick-p1" onClick={() => onChange('p1')}>
      pick
    </button>
  ),
}));
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m) } }));

const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('BudgetsScreen', () => {
  beforeEach(() => {
    simState.data = simResult;
    simState.isStale = false;
    simState.isError = false;
    simCalls.length = 0;
    saveMock.mockReset().mockResolvedValue([]);
    setPeriod.mockReset();
    toastSuccess.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  const renderScreen = (locale: 'fr' | 'en' = 'fr') =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
          <BudgetsScreen />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
  const field = (name: string) => screen.getByLabelText(`Budget ${name}`) as HTMLInputElement;
  const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });
  it('le montant vide suit la langue : 0,00 en fr, 0.00 en en', () => {
    renderScreen('fr');
    expect(field('Loisirs').placeholder).toBe('0,00');
    cleanup();
    renderScreen('en');
    expect((screen.getAllByPlaceholderText('0.00')).length).toBeGreaterThan(0);
  });
  it('les champs affichent le montant dans le format de la langue', () => {
    renderScreen('fr');
    expect(field('Loisirs').value).toBe('100,00');
    expect(field('Salaire').value).toBe('2500,00');
    cleanup();
    renderScreen('en');
    expect(field('Loisirs').value).toBe('100.00');
    expect(field('Salaire').value).toBe('2500.00');
  });

  it('un budget enregistré en négatif s\'affiche en positif et se modifie sans erreur', async () => {
    saved[0] = { id: 'b1', categoryId: 'e1', amountAllocated: '-18000' };
    try {
      renderScreen('fr');
      expect(field('Loisirs').value).toBe('180,00');
      type('Loisirs', '200,50');
      expect(screen.queryByTestId('row-error')).toBeNull();
      await act(async () => {
        fireEvent.click(screen.getByText('Enregistrer'));
      });
      expect(saveMock.mock.calls[0][0].data.budgets[0]).toEqual({ categoryId: 'e1', amountAllocated: '20050' });
      expect(saveMock.mock.calls[0][0].data.expectedBudgets[0]).toEqual({ categoryId: 'e1', amountAllocated: '-18000' });
    } finally {
      saved[0] = { id: 'b1', categoryId: 'e1', amountAllocated: '10000' };
    }
  });

  it('shows forecast, planned income and total budgeted', () => {
    renderScreen();
    const text = nbsp(document.body.textContent!);
    expect(text).toContain('1 234,56 €');
    expect(text).toContain('2 500,00 €');
    expect(text).toContain('700,00 €');
  });

  it('lists fixed and variable categories in one sorted list, overruns first, without the income', () => {
    renderScreen();
    const rows = within(screen.getByRole('table', { name: 'Dépenses' })).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      'Courses',
      'Livret',
      'Loisirs',
      'Cadeaux',
    ]);
  });

  it('puts the income categories in their own « Revenus » section, under the expenses', () => {
    renderScreen();
    const spending = screen.getByRole('table', { name: 'Dépenses' });
    const income = screen.getByRole('table', { name: 'Revenus' });
    expect(screen.getByRole('heading', { name: 'Revenus' })).toBeTruthy();
    expect(within(spending).queryByText('Salaire')).toBeNull();
    expect(within(income).getByText('Salaire')).toBeTruthy();
    // sous les dépenses dans la page
    expect(spending.compareDocumentPosition(income) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const row = nbsp(within(income).getAllByRole('row')[1].textContent!);
    expect(row).toContain('2 600,00 €');
    expect(row).not.toMatch(/restant|Reste/);
    expect(within(income).queryByText(/restants/)).toBeNull();
    // la saisie du revenu prévu reste possible
    expect(field('Salaire').value).toBe('2500,00');
  });

  it('shows the overrun amount of an overspent line, same figure as the Today block', () => {
    renderScreen();
    expect(nbsp(screen.getByTestId('over-budget').textContent!)).toContain('100,00 €');
  });

  it('shows what is left on a line within budget', () => {
    renderScreen();
    const row = (name: string) => nbsp(screen.getAllByRole('row').find((r) => r.textContent!.includes(name))!.textContent!);
    expect(row('Loisirs')).toContain('70,00 €');
  });

  it('stays exact beyond 2^53 for the overrun and what is left', () => {
    const saveExpenses = breakdown.expenses;
    breakdown.expenses = [
      { categoryId: 'e1', name: 'Loisirs', real: '-3000', budget: '10000', remaining: '9007199254740993', percentage: 30 },
      { categoryId: 'e2', name: 'Courses', real: '-60000', budget: '50000', remaining: '-9007199254740993', percentage: 120 },
    ];
    try {
      renderScreen();
      expect(nbsp(screen.getByTestId('over-budget').textContent!)).toContain('90 071 992 547 409,93 €');
      const loisirs = screen.getAllByRole('row').find((r) => r.textContent!.includes('Loisirs'))!;
      expect(nbsp(loisirs.textContent!)).toContain('90 071 992 547 409,93 €');
    } finally {
      breakdown.expenses = saveExpenses;
    }
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

  describe('saisie et simulation', () => {
    it('shows the saved amounts in the fields, empty for a category without budget', () => {
      renderScreen();
      expect(field('Courses').value).toBe('500,00');
      expect(field('Cadeaux').value).toBe('');
    });

    it('simulates with the complete list as soon as an amount changes, and shows the simulated forecast with the gap', () => {
      renderScreen();
      expect(screen.queryByTestId('forecast-delta')).toBeNull();
      type('Loisirs', '20');
      const last = simCalls[simCalls.length - 1];
      expect(last.enabled).toBe(true);
      expect(last.budgets).toEqual([
        { categoryId: 'e1', amountAllocated: '2000' },
        { categoryId: 'e2', amountAllocated: '50000' },
        { categoryId: 's1', amountAllocated: '10000' },
        { categoryId: 'i1', amountAllocated: '250000' },
      ]);
      expect(nbsp(screen.getByTestId('forecast-figure').textContent!)).toBe('1 000,00 €');
      expect(nbsp(screen.getByTestId('forecast-delta').textContent!)).toContain('-234,56 €');
      expect(nbsp(document.body.textContent!)).toContain('934,56 €');
    });

    it('greys the figure with « calcul en cours » until the answer of the last value arrives', () => {
      simState.isStale = true;
      renderScreen();
      type('Loisirs', '20');
      expect(screen.getByTestId('forecast-figure').getAttribute('data-stale')).toBe('true');
      expect(screen.getByTestId('calculating')).toBeTruthy();
    });

    it('says « sans effet » when the planned total moves but the forecast does not', () => {
      simState.data = { ...simResult, delta: '0', expensesEffect: '0', plannedExpenses: '30000' };
      renderScreen();
      type('Loisirs', '1');
      expect(screen.getByTestId('no-effect').textContent).toContain('Sans effet : le réel est déjà plus haut');
    });

    it('does not say « sans effet » when the forecast moves', () => {
      renderScreen();
      type('Loisirs', '20');
      expect(screen.queryByTestId('no-effect')).toBeNull();
    });

    it('does not say « sans effet » while the answer is stale', () => {
      simState.isStale = true;
      simState.data = { ...simResult, delta: '0', expensesEffect: '0', plannedExpenses: '30000' };
      renderScreen();
      type('Loisirs', '1');
      expect(screen.queryByTestId('no-effect')).toBeNull();
    });

    it('does not simulate when the typed value equals the saved one', () => {
      renderScreen();
      type('Courses', '500');
      expect(simCalls.every((c) => !c.enabled)).toBe(true);
      expect(screen.queryByText('Enregistrer')).toBeNull();
    });

    it('refuses an unreadable or negative value: message, no simulation, save disabled', () => {
      renderScreen();
      type('Loisirs', 'abc');
      expect(screen.getByTestId('row-error').textContent).toContain('illisible');
      type('Courses', '-5');
      expect(screen.getAllByTestId('row-error')).toHaveLength(2);
      expect(simCalls[simCalls.length - 1].enabled).toBe(false);
      expect((screen.getByText('Enregistrer') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('Annuler', () => {
    it('restores the saved amounts and hides the buttons', () => {
      renderScreen();
      type('Loisirs', '20');
      fireEvent.click(screen.getByText('Annuler'));
      expect(field('Loisirs').value).toBe('100,00');
      expect(screen.queryByText('Enregistrer')).toBeNull();
      expect(saveMock).not.toHaveBeenCalled();
    });
  });

  describe('Enregistrer', () => {
    it('sends every budget of the period, edited or not, with the budgets read as expected', async () => {
      renderScreen();
      type('Loisirs', '20');
      await act(async () => {
        fireEvent.click(screen.getByText('Enregistrer'));
      });
      expect(saveMock).toHaveBeenCalledTimes(1);
      const arg = saveMock.mock.calls[0][0];
      expect(arg.accountId).toBe('a');
      expect(arg.periodId).toBe('p0');
      expect(arg.data.budgets).toEqual([
        { categoryId: 'e1', amountAllocated: '2000' },
        { categoryId: 'e2', amountAllocated: '50000' },
        { categoryId: 's1', amountAllocated: '10000' },
        { categoryId: 'i1', amountAllocated: '250000' },
      ]);
      expect(arg.data.expectedBudgets).toEqual(saved.map(({ categoryId, amountAllocated }) => ({ categoryId, amountAllocated })));
      await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
      expect(screen.queryByText('Enregistrer')).toBeNull();
    });

    it('an emptied field is sent as 0', async () => {
      renderScreen();
      type('Loisirs', '');
      expect(simCalls[simCalls.length - 1].budgets[0]).toEqual({ categoryId: 'e1', amountAllocated: '0' });
      await act(async () => {
        fireEvent.click(screen.getByText('Enregistrer'));
      });
      expect(saveMock.mock.calls[0][0].data.budgets[0]).toEqual({ categoryId: 'e1', amountAllocated: '0' });
      expect(saveMock.mock.calls[0][0].data.expectedBudgets).toHaveLength(4);
    });

    it('a double click sends one request', async () => {
      let release: () => void = () => {};
      saveMock.mockImplementation(() => new Promise<void>((r) => (release = r)));
      renderScreen();
      type('Loisirs', '20');
      const button = screen.getByText('Enregistrer');
      fireEvent.click(button);
      fireEvent.click(button);
      expect(saveMock).toHaveBeenCalledTimes(1);
      await act(async () => release());
    });

    it('on failure keeps the inputs and the simulation, and explains', async () => {
      saveMock.mockRejectedValue(new AxiosError('boom', '500', undefined, undefined, { status: 500, data: {} } as never));
      renderScreen();
      type('Loisirs', '20');
      await act(async () => {
        fireEvent.click(screen.getByText('Enregistrer'));
      });
      expect(screen.getByTestId('budgets-banner').textContent).toContain('a échoué');
      expect(field('Loisirs').value).toBe('20');
      expect(screen.getByTestId('forecast-delta')).toBeTruthy();
      expect((screen.getByText('Enregistrer') as HTMLButtonElement).disabled).toBe(false);
    });

    it('does not send an unreadable value', async () => {
      renderScreen();
      type('Loisirs', 'abc');
      await act(async () => {
        fireEvent.click(screen.getByText('Enregistrer'));
      });
      expect(saveMock).not.toHaveBeenCalled();
    });

    it('on BUDGETS_CHANGED reloads the saved amounts and shows the refused inputs next to them', async () => {
      saveMock.mockRejectedValue(
        new AxiosError('conflict', '409', undefined, undefined, {
          status: 409,
          data: { code: 'BUDGETS_CHANGED' },
        } as never),
      );
      renderScreen();
      type('Loisirs', '20');
      await act(async () => {
        fireEvent.click(screen.getByText('Enregistrer'));
      });
      expect(screen.getByTestId('budgets-banner').textContent).toContain('ont changé');
      expect(field('Loisirs').value).toBe('100,00');
      expect(screen.getByTestId('rejected-input').textContent).toContain('20');
      expect(screen.queryByText('Enregistrer')).toBeNull();
    });

    it('another 409 (duplicate) is a plain failure, inputs kept', async () => {
      saveMock.mockRejectedValue(
        new AxiosError('dup', '409', undefined, undefined, { status: 409, data: {} } as never),
      );
      renderScreen();
      type('Loisirs', '20');
      await act(async () => {
        fireEvent.click(screen.getByText('Enregistrer'));
      });
      expect(field('Loisirs').value).toBe('20');
      expect(screen.queryByTestId('rejected-input')).toBeNull();
    });
  });

  describe('sortie avec des saisies', () => {
    it('asks before changing period when something is typed, and stays if refused', () => {
      const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderScreen();
      type('Loisirs', '20');
      fireEvent.click(screen.getByTestId('pick-p1'));
      expect(ask).toHaveBeenCalledTimes(1);
      expect(setPeriod).not.toHaveBeenCalled();
    });

    it('changes period after the user accepts to discard', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderScreen();
      type('Loisirs', '20');
      fireEvent.click(screen.getByTestId('pick-p1'));
      expect(setPeriod).toHaveBeenCalledWith('p1');
    });

    it('shows nothing and asks nothing without input', () => {
      const ask = vi.spyOn(window, 'confirm');
      renderScreen();
      fireEvent.click(screen.getByTestId('pick-p1'));
      expect(ask).not.toHaveBeenCalled();
      expect(setPeriod).toHaveBeenCalledWith('p1');
    });

    it('asks before following an in-app link, and cancels the navigation if refused', () => {
      const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderScreen();
      type('Loisirs', '20');
      const a = document.createElement('a');
      a.href = '/budgets/fixed';
      document.body.appendChild(a);
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      a.dispatchEvent(event);
      expect(ask).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
      a.remove();
    });

    it('does not ask for a link when nothing is typed', () => {
      const ask = vi.spyOn(window, 'confirm');
      renderScreen();
      const a = document.createElement('a');
      a.href = '/budgets/fixed';
      document.body.appendChild(a);
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      expect(ask).not.toHaveBeenCalled();
      a.remove();
    });

    it('asks before closing the tab when something is typed', () => {
      renderScreen();
      type('Loisirs', '20');
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
  });
});
