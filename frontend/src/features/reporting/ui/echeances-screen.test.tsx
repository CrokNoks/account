import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { EcheancesScreen } from './echeances-screen';

const account = vi.hoisted(() => ({ id: 'a1' as string | null }));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: account.id }),
}));
const lowPoint = vi.hoisted(() => ({ calendarProps: [] as unknown[] }));
vi.mock('../api/use-cashflow-forecast', () => ({
  useCashflowForecast: () => ({ data: { currentBalance: '1', events: [], lowPoint: { date: '2026-07-15T00:00:00.000Z', balance: '-300000' } } }),
}));
vi.mock('./cashflow-forecast', () => ({ CashflowForecast: () => <section aria-label="bloc-courbe" /> }));
vi.mock('./echeances-upcoming-list', () => ({ EcheancesUpcomingList: () => <section aria-label="bloc-liste" /> }));
vi.mock('./financial-calendar', () => ({ FinancialCalendar: (p: unknown) => { lowPoint.calendarProps.push(p); return <section aria-label="bloc-calendrier" />; } }));

const renderScreen = (locale: 'fr' | 'en' = 'fr') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <EcheancesScreen />
    </NextIntlClientProvider>,
  );

describe('Écran Échéances', () => {
  it('met courbe, calendrier et liste sur la même page, sans onglets', () => {
    account.id = 'a1';
    renderScreen();
    expect(screen.getByLabelText('bloc-courbe')).toBeTruthy();
    expect(screen.getByLabelText('bloc-calendrier')).toBeTruthy();
    expect(screen.getByLabelText('bloc-liste')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    // Un seul titre par écran : celui de l'en-tête, la page n'en répète pas.
    expect(screen.queryByRole('heading', { name: 'Échéances' })).toBeNull();
    expect(screen.queryByText(fr.Reporting.echeances.desc)).toBeNull();
  });

  it('passe au calendrier le jour du point bas donné par le back', () => {
    account.id = 'a1';
    renderScreen();
    expect(lowPoint.calendarProps.at(-1)).toMatchObject({ lowPointDate: '2026-07-15' });
  });

  it('sans compte, demande d\'en choisir un', () => {
    account.id = null;
    renderScreen();
    expect(screen.getByRole('status').textContent).toContain('Choisissez un compte');
    expect(screen.queryByLabelText('bloc-courbe')).toBeNull();
  });
});
