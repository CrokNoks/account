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
vi.mock('./cashflow-forecast', () => ({ CashflowForecast: () => <section aria-label="bloc-courbe" /> }));
vi.mock('./echeances-upcoming-list', () => ({ EcheancesUpcomingList: () => <section aria-label="bloc-liste" /> }));
vi.mock('./financial-calendar', () => ({ FinancialCalendar: () => <section aria-label="bloc-calendrier" /> }));

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
    expect(screen.getByRole('heading', { name: 'Échéances' })).toBeTruthy();
  });

  it('est titré « Due dates » en anglais', () => {
    account.id = 'a1';
    renderScreen('en');
    expect(screen.getByRole('heading', { name: 'Due dates' })).toBeTruthy();
  });

  it('sans compte, demande d\'en choisir un', () => {
    account.id = null;
    renderScreen();
    expect(screen.getByRole('status').textContent).toContain('Choisissez un compte');
    expect(screen.queryByLabelText('bloc-courbe')).toBeNull();
  });
});
