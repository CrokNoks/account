import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  BalanceBar: () => <div data-testid="balance-bar" data-tour="stats" />,
}));
vi.mock('@/features/reporting/ui/to-handle', () => ({ ToHandle: () => <div data-testid="to-handle" /> }));
vi.mock('@/features/reporting/ui/budget-breakdown', () => ({ BudgetBreakdown: () => <div data-testid="budgets" /> }));
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

  it('affiche la barre des soldes puis À traiter, Budgets et Factures, sans personnalisation', () => {
    renderHome();

    for (const id of ['balance-bar', 'to-handle', 'budgets', 'bills']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    expect(screen.queryByTitle(/Personnaliser/)).toBeNull();
    expect(screen.queryByText('Patrimoine Net')).toBeNull();
  });

  it('pose les cibles de la visite guidée sur les blocs de l\'écran fixe', () => {
    const { container } = renderHome();

    for (const target of ['stats', 'budget-breakdown', 'to-handle', 'add-transaction']) {
      expect(container.querySelector(`[data-tour="${target}"]`)).not.toBeNull();
    }
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
    for (const id of ['balance-bar', 'to-handle', 'budgets', 'bills']) {
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
