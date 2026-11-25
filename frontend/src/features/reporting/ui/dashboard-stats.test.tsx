import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { BalanceBar } from './dashboard-stats';

const stats = vi.hoisted(() => ({
  value: {
    startBalance: '120000',
    realIncome: '260000',
    plannedIncome: '250000',
    realExpenses: '-45000',
    plannedExpenses: '40000',
    realBankBalance: '340000',
    upcomingBalance: '345000',
    forecastBalance: '330000',
    cardTotal: '0',
    cardCount: 0,
    billsTotal: '0',
    reportsTotal: '0',
    arrivedAfterEnd: '0',
    budgetRemaining: '0',
    expectedIncome: '0',
  },
}));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
const periods = vi.hoisted(() => ({
  value: [{ id: 'p1', startDate: '2026-11-01', endDate: '2026-11-30', isActive: true }] as Array<{
    id: string;
    startDate: string;
    endDate: string | null;
    estimatedEndDate?: string | null;
    isActive: boolean;
  }>,
}));
vi.mock('@/features/budgets/api/use-periods', () => ({
  usePeriods: () => ({ data: periods.value, isLoading: false }),
}));
vi.mock('../api/use-reporting-stats', () => ({
  useReportingStats: () => ({ isLoading: false, data: stats.value }),
}));

const renderBar = (locale: 'fr' | 'en' = 'fr') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <BalanceBar />
    </NextIntlClientProvider>,
  );

// Les montants passent par formatCurrency : on compare sans les espaces (fines, insécables).
const text = (el: HTMLElement) => el.textContent!.replace(/\s/g, '');

describe('Barre des soldes', () => {
  it('un seul bloc : prévu, En banque, À venir et composition du prévu dans la cible « stats »', () => {
    const { container } = renderBar();
    const hero = container.querySelector('[data-tour="stats"]')!;
    for (const id of ['balance-forecast', 'balance-bank', 'balance-upcoming', 'composition']) {
      expect(hero.contains(screen.getByTestId(id))).toBe(true);
    }
    expect(container.querySelectorAll('[data-tour="stats"]')).toHaveLength(1);
    // la composition n'a plus de carte propre
    expect(screen.getByTestId('composition').closest('[data-slot="card"]')).toBe(hero.querySelector('[data-slot="card"]'));
  });

  it('met le prévu en chiffre principal, avec le solde en banque et le solde à venir', () => {
    renderBar();

    expect(text(screen.getByTestId('balance-forecast'))).toContain('3300,00€');
    expect(screen.getByTestId('forecast-title').textContent).toBe('Prévu le 30 nov.');
    expect(text(screen.getByTestId('balance-bank'))).toContain('3400,00€');
    expect(text(screen.getByTestId('balance-upcoming'))).toContain('3450,00€');
  });

  it('met le prévu négatif en orange avec son « - », sinon en encre (ni vert ni rouge)', () => {
    stats.value = { ...stats.value, forecastBalance: '-103255' };
    renderBar();
    const negative = screen.getByTestId('balance-forecast').querySelector('[data-amount]')!;
    expect(negative.className).toContain('text-warn');
    expect(negative.className).not.toMatch(/text-(red|green)/);
    expect(text(negative as HTMLElement)).toContain('-1032,55');

    stats.value = { ...stats.value, forecastBalance: '5000' };
    document.body.innerHTML = '';
    renderBar();
    const positive = screen.getByTestId('balance-forecast').querySelector('[data-amount]')!;
    expect(positive.className).toContain('text-foreground');
    expect(positive.className).not.toMatch(/text-(red|green)/);
  });

  it('garde une taille lisible sur mobile et porte la cible de la visite guidée', () => {
    const { container } = renderBar();
    expect(container.querySelector('[data-tour="stats"]')).not.toBeNull();
    expect(screen.getByTestId('balance-forecast').querySelector('[data-amount]')!.className).toMatch(/max-lg:text-/);
  });

  describe('bureau : période et prévu datés', () => {
    const initialPeriods = periods.value;
    afterEach(() => {
      vi.useRealTimers();
      periods.value = initialPeriods;
    });
    const at = (y: number, m: number, d: number) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(y, m, d, 12));
    };

    it('« 1 nov. → 30 nov. · jour 24 sur 30 » et « Prévu le 30 nov. »', () => {
      at(2026, 10, 24);
      renderBar();
      expect(screen.getByTestId('period-subtitle-desktop').textContent).toBe('1 nov. → 30 nov. · jour 24 sur 30');
      expect(screen.getByTestId('forecast-title').textContent).toBe('Prévu le 30 nov.');
      expect(screen.getByTestId('period-subtitle-desktop').className).toContain('max-lg:hidden');
      // mobile inchangé, sans doublon
      expect(screen.getByTestId('period-day').textContent).toBe('Jour 24 sur 30');
    });

    it('en anglais', () => {
      at(2026, 10, 24);
      renderBar('en');
      expect(screen.getByTestId('period-subtitle-desktop').textContent).toBe('Nov 1 → Nov 30 · day 24 of 30');
      expect(screen.getByTestId('forecast-title').textContent).toBe('Forecast on Nov 30');
    });

    it('période passée : dates seules, sans « jour X sur Y »', () => {
      at(2026, 11, 2);
      renderBar();
      expect(screen.getByTestId('period-subtitle-desktop').textContent).toBe('1 nov. → 30 nov.');
    });

    it('sans fin : le début seul et « Prévu en fin de période »', () => {
      at(2026, 10, 24);
      periods.value = [{ id: 'p1', startDate: '2026-11-01', endDate: null, isActive: true }];
      renderBar();
      expect(screen.getByTestId('period-subtitle-desktop').textContent).toBe('1 nov.');
      expect(screen.getByTestId('forecast-title').textContent).toBe('Prévu en fin de période');
    });

    it('fin estimée : utilisée comme fin', () => {
      at(2026, 10, 24);
      periods.value = [{ id: 'p1', startDate: '2026-11-01', endDate: null, estimatedEndDate: '2026-11-30', isActive: true }];
      renderBar();
      expect(screen.getByTestId('period-subtitle-desktop').textContent).toBe('1 nov. → 30 nov. · jour 24 sur 30');
    });
  });

  describe('accueil mobile', () => {
    const initialPeriods = periods.value;
    afterEach(() => {
      vi.useRealTimers();
      periods.value = initialPeriods;
    });

    it('annonce « Prévu le {fin} » puis « Jour X sur Y »', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 15, 12));
      renderBar();
      expect(screen.getByTestId('forecast-title-mobile').textContent).toBe('Prévu le 30 nov.');
      expect(screen.getByTestId('period-day').textContent).toBe('Jour 15 sur 30');
    });

    it('en anglais', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 15, 12));
      renderBar('en');
      expect(screen.getByTestId('forecast-title-mobile').textContent).toBe('Forecast on Nov 30');
      expect(screen.getByTestId('period-day').textContent).toBe('Day 15 of 30');
    });

    it('utilise la fin estimée d\'une période ouverte', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 15, 12));
      periods.value = [{ id: 'p1', startDate: '2026-11-01', endDate: null, estimatedEndDate: '2026-11-30', isActive: true }];
      renderBar();
      expect(screen.getByTestId('forecast-title-mobile').textContent).toBe('Prévu le 30 nov.');
      expect(screen.getByTestId('period-day').textContent).toBe('Jour 15 sur 30');
    });

    it('masque « Jour X sur Y » si la période est passée ou sans date de fin, et garde le titre simple', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 11, 2, 12));
      renderBar();
      expect(screen.queryByTestId('period-day')).toBeNull();
      document.body.innerHTML = '';
      periods.value = [{ id: 'p1', startDate: '2026-11-01', endDate: null, isActive: true }];
      renderBar();
      expect(screen.queryByTestId('period-day')).toBeNull();
      expect(screen.getByTestId('forecast-title-mobile').textContent).toBe('Prévu en fin de période');
    });

    it('masque En banque et le solde à venir sur mobile (bureau seulement)', () => {
      renderBar();
      expect(screen.getByTestId('balance-bank').closest('.max-lg\\:hidden')).not.toBeNull();
      expect(screen.getByTestId('balance-upcoming').closest('.max-lg\\:hidden')).not.toBeNull();
      expect(screen.getByTestId('balance-forecast').closest('.max-lg\\:hidden')).toBeNull();
    });
  });

  it('est traduit en anglais', () => {
    renderBar('en');
    expect(screen.getByTestId('forecast-title').textContent).toMatch(/^Forecast on /);
  });
});
