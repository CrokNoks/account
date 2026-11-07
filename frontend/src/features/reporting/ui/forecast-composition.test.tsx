import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { ForecastComposition } from './forecast-composition';

const base = {
  startBalance: '100000',
  realIncome: '200000',
  plannedIncome: '200000',
  realExpenses: '-23000',
  plannedExpenses: '30000',
  realBankBalance: '290000',
  upcomingBalance: '285000',
  forecastBalance: '270000',
  cardTotal: '-5000',
  cardCount: 1,
  billsTotal: '-8000',
  budgetRemaining: '-7000',
  expectedIncome: '0',
};
const state = vi.hoisted(() => ({ stats: undefined as unknown }));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('../api/use-reporting-stats', () => ({
  useReportingStats: () => ({ isLoading: false, data: state.stats }),
}));

const show = (locale: 'fr' | 'en' = 'fr') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <ForecastComposition />
    </NextIntlClientProvider>,
  );
const text = (el: HTMLElement) => el.textContent!.replace(/\s/g, '');

describe('Composition du prévu', () => {
  beforeEach(() => {
    state.stats = { ...base };
  });

  it('affiche une barre quand CB et factures sont des sorties et rien n\'est attendu en revenus', () => {
    show();

    expect(screen.getByTestId('composition-bar')).toBeTruthy();
    expect(screen.queryByTestId('composition-lines')).toBeNull();
    const bar = screen.getByTestId('composition-bar');
    expect(text(bar)).toContain('CBnonpointées50,00');
    expect(text(bar)).toContain('2700,00');
  });

  it('la légende ne tronque pas les libellés sur mobile (une colonne, pas de truncate hors bureau)', () => {
    show();

    const legend = screen.getByTestId('composition-bar').querySelector('ul')!;
    expect(legend.className.split(' ')).toContain('grid-cols-1');
    expect(legend.className.split(' ')).toContain('lg:grid-cols-2');
    const label = screen.getByText('CB non pointées');
    expect(label.className.split(' ')).not.toContain('truncate');
  });

  it('un segment à 0 garde la barre', () => {
    state.stats = { ...base, cardTotal: '0', cardCount: 0, forecastBalance: '275000' };
    show();

    expect(screen.getByTestId('composition-bar')).toBeTruthy();
    expect(screen.queryByTestId('segment-card')).toBeNull();
  });

  it('affiche des lignes signées avec des revenus attendus, le prévu en dernier', () => {
    state.stats = { ...base, expectedIncome: '50000', forecastBalance: '320000' };
    show();

    const lines = screen.getByTestId('composition-lines');
    expect(screen.queryByTestId('composition-bar')).toBeNull();
    expect(text(within(lines).getByTestId('line-card'))).toContain('-50,00');
    expect(text(within(lines).getByTestId('line-budget'))).toContain('-70,00');
    expect(text(within(lines).getByTestId('line-income'))).toContain('500,00');
    expect(lines.lastElementChild!.getAttribute('data-testid')).toBe('line-forecast');
  });

  it('affiche des lignes quand le prévu est négatif ou la CB positive', () => {
    state.stats = { ...base, forecastBalance: '-1000' };
    const { unmount } = show();
    expect(screen.getByTestId('composition-lines')).toBeTruthy();
    unmount();

    state.stats = { ...base, cardTotal: '4000' };
    show();
    expect(screen.getByTestId('composition-lines')).toBeTruthy();
  });

  it('est traduit en anglais', () => {
    show('en');
    expect(screen.getByText('Forecast breakdown')).toBeTruthy();
    expect(screen.getByText('Upcoming bills')).toBeTruthy();
  });
});
