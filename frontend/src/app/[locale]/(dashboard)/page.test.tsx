import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import Home from './page';

const state = vi.hoisted(() => ({
  periods: [] as Array<{ id: string; startDate: string; endDate: string; isActive: boolean }>,
  accounts: [{ id: 'a1' }] as Array<{ id: string }>,
  push: vi.fn(),
  openDrawer: vi.fn(),
  startTour: vi.fn(),
  completedTours: {} as Record<string, boolean>,
}));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1', setActivePeriodId: vi.fn() }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({
  usePeriods: () => ({ data: state.periods, isLoading: false }),
}));
vi.mock('@/features/accounts/api/use-accounts', () => ({
  useAccounts: () => ({ data: state.accounts, isLoading: false }),
}));
vi.mock('@/shared/model/use-ui-store', () => ({
  useUiStore: () => ({
    startTour: state.startTour,
    completedTours: state.completedTours,
    setCreateTransactionDrawerOpen: state.openDrawer,
  }),
}));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@/shared/ui/tour/HelpButton', () => ({ HelpButton: () => <span data-testid="help" /> }));
vi.mock('@/features/reporting/ui/dashboard-stats', () => ({
  BalanceBar: () => (
    <div data-testid="balance-bar" data-tour="stats">
      <div data-testid="composition" />
    </div>
  ),
}));
vi.mock('@/features/reporting/ui/spending-pace', () => ({ SpendingPace: () => <div data-testid="pace" /> }));
vi.mock('@/features/reporting/ui/to-handle', () => ({ ToHandle: () => <div data-testid="to-handle" /> }));
vi.mock('@/features/reporting/ui/budget-breakdown', () => ({ BudgetBreakdown: () => <div data-testid="budgets" /> }));
vi.mock('@/features/reporting/ui/budgets-to-watch', () => ({ BudgetsToWatch: () => <div data-testid="watch" /> }));
vi.mock('@/features/reporting/ui/upcoming-deadlines-widget', () => ({
  UpcomingDeadlinesWidget: () => <div data-testid="bills" />,
}));
vi.mock('@/features/periods/ui/create-period-dialog', () => ({
  CreatePeriodDialog: () => <button>Créer une période</button>,
}));

const renderHome = (locale: 'fr' | 'en' = 'fr') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <Home />
    </NextIntlClientProvider>,
  );

describe('Écran Aujourd\'hui', () => {
  beforeEach(() => {
    state.periods = [{ id: 'p1', startDate: '2026-11-01', endDate: '2026-11-30', isActive: true }];
    state.accounts = [{ id: 'a1' }];
    state.push.mockReset();
    state.openDrawer.mockReset();
    state.completedTours = {};
  });

  it('affiche le bloc hero (soldes et composition), le rythme, À traiter, Budgets et Factures, sans personnalisation', () => {
    renderHome();

    for (const id of ['balance-bar', 'composition', 'pace', 'to-handle', 'budgets', 'bills', 'watch']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    expect(screen.queryByTitle(/Personnaliser/)).toBeNull();
    expect(screen.queryByText('Patrimoine Net')).toBeNull();
  });

  it("ne répète pas le titre de l'en-tête ni son accroche : un seul titre par écran", () => {
    renderHome('fr');
    expect(screen.queryByRole('heading', { level: 2, name: "Aujourd'hui" })).toBeNull();
    expect(screen.queryByText(fr.Dashboard.welcome)).toBeNull();
  });

  it('pose les cibles de la visite guidée sur les blocs de l\'écran fixe', () => {
    const { container } = renderHome();

    for (const target of ['stats', 'budget-breakdown', 'budgets-to-watch', 'to-handle', 'add-transaction']) {
      expect(container.querySelectorAll(`[data-tour="${target}"]`)).toHaveLength(1);
    }
  });

  it('bureau : rythme 2/3 + À traiter 1/3, puis Budgets variables 2/3 + Prochaines factures 1/3 ; mobile : À traiter puis Budgets à surveiller', () => {
    renderHome();
    const col = (id: string) => screen.getByTestId(id).closest('[class*="lg:col-span"]') as HTMLElement;
    expect(col('pace').className).toContain('lg:col-span-2');
    expect(col('to-handle').className).toContain('lg:col-span-1');
    expect(col('budgets').className).toContain('lg:col-span-2');
    expect(col('bills').className).toContain('lg:col-span-1');
    // rythme et À traiter partagent une grille, Budgets et Factures la suivante
    expect(col('pace').parentElement).toBe(col('to-handle').parentElement);
    expect(col('budgets').parentElement).toBe(col('bills').parentElement);
    expect(col('pace').parentElement).not.toBe(col('budgets').parentElement);
    // ordre mobile dans le document : hero, À traiter, Budgets à surveiller
    const order = ['balance-bar', 'to-handle', 'watch'].map((id) => screen.getByTestId(id));
    for (let i = 0; i < order.length - 1; i++) {
      expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('masque sur mobile le rythme, les échéances, la répartition et « Nouvelle opération » ; le bureau garde tout', () => {
    renderHome();
    const hiddenOnMobile = (el: HTMLElement) => el.closest('.max-lg\\:hidden') !== null;
    expect(hiddenOnMobile(screen.getByTestId('pace'))).toBe(true);
    expect(hiddenOnMobile(screen.getByTestId('bills'))).toBe(true);
    expect(hiddenOnMobile(screen.getByTestId('budgets'))).toBe(true);
    expect(hiddenOnMobile(screen.getByRole('button', { name: 'Nouvelle opération' }))).toBe(true);
    // Mobile : Budgets à surveiller remplace la répartition ; il n'est pas affiché sur bureau.
    expect(hiddenOnMobile(screen.getByTestId('watch'))).toBe(false);
    expect(screen.getByTestId('watch').closest('.lg\\:hidden')).not.toBeNull();
    // Ce qui reste sur mobile : prévu, composition, À traiter.
    for (const id of ['balance-bar', 'composition', 'to-handle']) expect(hiddenOnMobile(screen.getByTestId(id))).toBe(false);
  });

  describe('visite guidée', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      state.startTour.mockReset();
      state.completedTours = { account: true };
    });
    afterEach(() => vi.useRealTimers());

    it('démarre quand une période existe et que chaque cible est à l\'écran', () => {
      const { container } = renderHome();
      act(() => { vi.advanceTimersByTime(1100); });

      expect(state.startTour).toHaveBeenCalledWith('dashboard');
      for (const target of ['stats', 'budget-breakdown', 'to-handle', 'add-transaction']) {
        expect(container.querySelector(`[data-tour="${target}"]`)).not.toBeNull();
      }
    });

    it('ne démarre pas sans aucune période (les cibles sont absentes)', () => {
      state.periods = [];
      const { container } = renderHome();
      act(() => { vi.advanceTimersByTime(1100); });

      expect(state.startTour).not.toHaveBeenCalled();
      expect(container.querySelector('[data-tour="to-handle"]')).toBeNull();
    });
  });

  it('« Nouvelle opération » ouvre le formulaire de saisie', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle opération' }));
    expect(state.openDrawer).toHaveBeenCalledWith(true);
  });

  it('sans aucune période, remplace tout l\'écran par une explication et un bouton de création', () => {
    state.periods = [];
    renderHome();

    expect(screen.getByText('Aucune période pour ce compte')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer une période' })).toBeTruthy();
    for (const id of ['balance-bar', 'composition', 'pace', 'to-handle', 'budgets', 'bills']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it('est traduit en anglais', () => {
    renderHome('en');
    expect(screen.getByRole('button', { name: 'New transaction' })).toBeTruthy();
  });

  it('redirige vers /accounts sans compte', () => {
    state.accounts = [];
    renderHome();
    expect(state.push).toHaveBeenCalledWith('/accounts');
  });
});
