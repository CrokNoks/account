import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { StatBankBalance, StatIncomeExpenses, StatUpcomingBalance } from './dashboard-stats';

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('../api/use-reporting-stats', () => ({
  useReportingStats: () => ({
    isLoading: false,
    data: {
      startBalance: '120000',
      realIncome: '260000',
      plannedIncome: '250000',
      realExpenses: '-45000',
      plannedExpenses: '40000',
      realBankBalance: '340000',
      upcomingBalance: '345000',
      forecastBalance: '330000',
    },
  }),
}));

const renderFr = (ui: React.ReactElement) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      {ui}
    </NextIntlClientProvider>,
  );

// Les montants passent par formatCurrency : on compare sans les espaces (fines, insécables).
const text = () => document.body.textContent!.replace(/\s/g, '');

describe('Cartes de solde du tableau de bord', () => {
  it('shows the bank balance with the start balance underneath', () => {
    renderFr(<StatBankBalance />);

    expect(screen.getByText('Solde en banque (pointé)')).toBeTruthy();
    expect(text()).toContain('3400,00€');
    expect(text()).toContain('Soldeinitial:1200,00€');
  });

  it('shows the upcoming balance with the end-of-period forecast underneath', () => {
    renderFr(<StatUpcomingBalance />);

    expect(screen.getByText('Solde à venir')).toBeTruthy();
    expect(text()).toContain('3450,00€');
    expect(text()).toContain('Findepériodeprévue:3300,00€');
  });

  it('shows real and planned income and expenses in one card', () => {
    renderFr(<StatIncomeExpenses />);

    expect(screen.getByText('Revenus / Dépenses')).toBeTruthy();
    expect(text()).toContain('2600,00€');
    expect(text()).toContain('-450,00€');
    expect(text()).toContain('Prévu:2500,00€');
    expect(text()).toContain('Prévu:400,00€');
  });
});
