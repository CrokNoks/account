import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  reportsTotal: '0',
  arrivedAfterEnd: '0',
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

  it('affiche les reports et l\'arrivé après la fin dans la barre quand ils ne sont pas nuls', () => {
    state.stats = { ...base, realBankBalance: '320000', reportsTotal: '-15000', arrivedAfterEnd: '-30000', forecastBalance: '255000' };
    show();

    const bar = screen.getByTestId('composition-bar');
    expect(text(within(bar).getByText('Reports').closest('li')!)).toContain('150,00');
    expect(text(within(bar).getByText('Arrivé après la fin').closest('li')!)).toContain('300,00');
    expect(screen.getByTestId('segment-reports')).toBeTruthy();
    expect(screen.getByTestId('segment-arrived')).toBeTruthy();
  });

  it('masque les lignes reports et arrivé après la fin quand elles valent 0', () => {
    state.stats = { ...base, expectedIncome: '50000', forecastBalance: '320000' };
    show();

    const lines = screen.getByTestId('composition-lines');
    expect(within(lines).queryByTestId('line-reports')).toBeNull();
    expect(within(lines).queryByTestId('line-arrived')).toBeNull();
  });

  it('passe en lignes signées quand les reports sont positifs, avec les deux lignes', () => {
    state.stats = { ...base, reportsTotal: '20000', arrivedAfterEnd: '-30000', expectedIncome: '30000', forecastBalance: '305000' };
    show();

    const lines = screen.getByTestId('composition-lines');
    expect(screen.queryByTestId('composition-bar')).toBeNull();
    expect(text(within(lines).getByTestId('line-reports'))).toContain('200,00');
    expect(text(within(lines).getByTestId('line-arrived'))).toContain('-300,00');
  });

  it('est traduit en anglais', () => {
    show('en');
    expect(screen.getByText('Forecast breakdown')).toBeTruthy();
    expect(screen.getByText('Upcoming bills')).toBeTruthy();
  });

  it('affiche les montants exacts au-delà de 2^53 (barre et lignes)', () => {
    state.stats = { ...base, realBankBalance: '9007199254740995', forecastBalance: '9007199254740991', cardTotal: '-1', billsTotal: '-1', budgetRemaining: '-2' };
    show();
    const bar = text(screen.getByTestId('composition-bar'));
    expect(bar).toContain('90071992547409,91€');
    expect(bar).toContain('0,02€');
    cleanup();
    state.stats = { ...base, realBankBalance: '9007199254740995', expectedIncome: '1', forecastBalance: '9007199254740993', cardTotal: '-1', billsTotal: '-1', budgetRemaining: '-1' };
    show();
    const lines = text(screen.getByTestId('composition-lines'));
    expect(lines).toContain('90071992547409,95€');
    expect(lines).toContain('90071992547409,93€');
  });

  describe('détail du budget restant', () => {
    const detail = [
      { categoryId: 'c1', name: 'Courses', remaining: '4000' },
      { categoryId: 'c2', name: 'Loisirs', remaining: '3000' },
    ];

    it('masque le détail par défaut puis le déplie et le replie au toucher (barre)', () => {
      state.stats = { ...base, budgetRemainingDetail: detail };
      show();

      expect(screen.queryByTestId('budget-detail')).toBeNull();
      fireEvent.click(screen.getByTestId('budget-toggle'));
      const panel = screen.getByTestId('budget-detail');
      expect(within(panel).getAllByRole('listitem').map((li) => text(li))).toEqual(['Courses40,00€', 'Loisirs30,00€']);
      fireEvent.click(screen.getByTestId('budget-toggle'));
      expect(screen.queryByTestId('budget-detail')).toBeNull();
    });

    it('marche en lignes signées', () => {
      state.stats = { ...base, expectedIncome: '50000', forecastBalance: '320000', budgetRemainingDetail: detail };
      show();

      fireEvent.click(within(screen.getByTestId('line-budget')).getByTestId('budget-toggle'));
      expect(text(screen.getByTestId('budget-detail'))).toContain('Courses40,00€');
    });

    it('est réservé au mobile : volet et bouton neutralisés dès lg', () => {
      state.stats = { ...base, budgetRemainingDetail: detail };
      show();

      fireEvent.click(screen.getByTestId('budget-toggle'));
      const toggle = screen.getByTestId('budget-toggle');
      expect(toggle.className.split(' ')).toContain('lg:hidden');
      // Sur bureau : ligne simple, sans bouton ni aria-expanded.
      const desktop = screen.getByTestId('budget-row-desktop');
      expect(desktop.className.split(' ')).toContain('max-lg:hidden');
      expect(desktop.closest('button')).toBeNull();
      expect(desktop.querySelector('[aria-expanded]')).toBeNull();
      expect(desktop.hasAttribute('aria-expanded')).toBe(false);
      expect(screen.getByTestId('budget-detail').className.split(' ')).toContain('lg:hidden');
    });

    it('n\'est pas cliquable avec un budget restant à 0', () => {
      state.stats = { ...base, budgetRemaining: '0', forecastBalance: '277000', budgetRemainingDetail: detail };
      show();

      expect(screen.queryByTestId('budget-toggle')).toBeNull();
    });

    it('n\'est pas cliquable sans détail ou avec un détail vide', () => {
      show();
      expect(screen.queryByTestId('budget-toggle')).toBeNull();
      cleanup();
      state.stats = { ...base, budgetRemainingDetail: [] };
      show();
      expect(screen.queryByTestId('budget-toggle')).toBeNull();
    });

    it('affiche la liste telle quelle, sans tri ni filtre, et traduite en anglais', () => {
      state.stats = { ...base, budgetRemainingDetail: [detail[1], detail[0]] };
      show('en');

      fireEvent.click(screen.getByTestId('budget-toggle'));
      const panel = screen.getByTestId('budget-detail');
      expect(within(panel).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('Loisirs'), expect.stringContaining('Courses')]);
      expect(panel.getAttribute('aria-label')).toBe('Remaining budget by category');
    });
  });
});
