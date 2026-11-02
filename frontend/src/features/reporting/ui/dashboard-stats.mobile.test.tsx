import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { StatUpcomingBalance } from './dashboard-stats';

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('../api/use-reporting-stats', () => ({
  useReportingStats: () => ({
    isLoading: false,
    data: { startBalance: '0', realIncome: '0', plannedIncome: '0', realExpenses: '0', plannedExpenses: '0', realBankBalance: '31134', upcomingBalance: '31134', forecastBalance: '-103255' },
  }),
}));

describe('Carte « solde à venir »', () => {
  it('colours the end-of-period forecast red when negative and keeps a readable size on mobile', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <StatUpcomingBalance />
      </NextIntlClientProvider>,
    );
    const sub = screen.getByText(/Fin de période prévue/);
    expect(sub.className).toContain('text-red-500');
    expect(sub.className).toMatch(/max-lg:text-xs/);
  });
});
