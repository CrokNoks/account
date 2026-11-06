import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { SpendingPace } from './spending-pace';

const state = vi.hoisted(() => ({ pace: undefined as unknown }));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('../api/use-spending-pace', () => ({
  useSpendingPace: () => ({ isLoading: false, data: state.pace }),
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const point = (day: number, cumulative: string, previousCumulative: string | null) => ({
  day,
  date: `2026-11-${String(day).padStart(2, '0')}`,
  cumulative,
  previousCumulative,
});
const show = (locale: 'fr' | 'en' = 'fr') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <SpendingPace />
    </NextIntlClientProvider>,
  );
const text = (el: HTMLElement) => el.textContent!.replace(/\s/g, '');

describe('Rythme de dépense', () => {
  beforeEach(() => {
    state.pace = undefined;
  });

  it('dit « de plus » quand la période dépense plus qu\'à la même date', () => {
    state.pace = { points: [point(1, '1500', '1000')], previousPeriodId: 'p0', gap: '500' };
    show();
    expect(text(screen.getByTestId('pace-gap'))).toBe("5,00€deplusqu'àlamêmedate");
  });

  it('dit « de moins » avec un écart négatif', () => {
    state.pace = { points: [point(1, '800', '1000')], previousPeriodId: 'p0', gap: '-200' };
    show();
    expect(text(screen.getByTestId('pace-gap'))).toBe("2,00€demoinsqu'àlamêmedate");
  });

  it('sans période précédente : courbe seule, sans phrase d\'écart', () => {
    state.pace = { points: [point(1, '800', null)], previousPeriodId: null, gap: null };
    show();
    expect(screen.queryByTestId('pace-gap')).toBeNull();
    expect(screen.getByTestId('spending-pace')).toBeTruthy();
    expect(screen.queryByText('Aucune donnée à afficher pour l\'instant')).toBeNull();
  });

  it('sans point : message vide', () => {
    state.pace = { points: [], previousPeriodId: null, gap: null };
    show();
    expect(screen.getByText('Aucune donnée à afficher pour l\'instant')).toBeTruthy();
  });

  it('est traduit en anglais', () => {
    state.pace = { points: [point(1, '1500', '1000')], previousPeriodId: 'p0', gap: '500' };
    show('en');
    expect(screen.getByText('Spending pace')).toBeTruthy();
    expect(text(screen.getByTestId('pace-gap'))).toContain('morethanonthesamedate');
  });
});
