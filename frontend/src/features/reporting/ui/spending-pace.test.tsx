import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { SpendingPace } from './spending-pace';
import { paceChartData, paceTicks, paceTooltipAmount, paceYMax } from '../model/pace-chart';

const state = vi.hoisted(() => ({ pace: undefined as unknown, planned: '241000' as string | undefined }));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('../api/use-reporting-stats', () => ({
  useReportingStats: () => ({ isLoading: false, data: state.planned === undefined ? undefined : { plannedExpenses: state.planned } }),
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
    state.planned = '241000';
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

  describe('ligne Budget, légende, axe', () => {
    const twoPeriods = () => ({ points: [point(1, '1500', '1000'), point(2, '2000', '1800')], previousPeriodId: 'p0', gap: '200' });

    it('affiche « Budget {Total budgété} » quand il y a un budget', () => {
      state.pace = twoPeriods();
      show();
      expect(text(screen.getByTestId('pace-budget'))).toBe('Budget2410,00€');
    });

    it('le montant du budget n\'est écrit qu\'une fois (légende), pas sur la courbe', () => {
      state.pace = twoPeriods();
      show();
      const card = screen.getByTestId('spending-pace');
      expect(text(card).split('2410,00€').length - 1).toBe(1);
    });

    it('sans budget (0) ou sans stats : pas de ligne Budget', () => {
      state.pace = twoPeriods();
      state.planned = '0';
      show();
      expect(screen.queryByTestId('pace-budget')).toBeNull();
      cleanup();
      state.planned = undefined;
      show();
      expect(screen.queryByTestId('pace-budget')).toBeNull();
    });

    it('légende : Cette période et Période précédente, visibles hors infobulle', () => {
      state.pace = twoPeriods();
      show();
      const legend = screen.getByTestId('pace-legend');
      expect(legend.textContent).toContain('Cette période');
      expect(legend.textContent).toContain('Période précédente');
    });

    it('sans période précédente : pas de « Période précédente »', () => {
      state.pace = { points: [point(1, '800', null)], previousPeriodId: null, gap: null };
      show();
      expect(screen.getByTestId('pace-legend').textContent).toContain('Cette période');
      expect(screen.getByTestId('pace-legend').textContent).not.toContain('Période précédente');
    });

    it('en anglais', () => {
      state.pace = twoPeriods();
      show('en');
      expect(screen.getByTestId('pace-legend').textContent).toContain('Previous period');
      expect(text(screen.getByTestId('pace-budget'))).toBe('Budget€2,410.00');
    });
  });

  it('affiche un écart exact au-delà de 2^53 (plus et moins)', () => {
    state.pace = { points: [point(1, '1500', '1000')], previousPeriodId: 'p0', gap: '9007199254740993' };
    show();
    expect(text(screen.getByTestId('pace-gap'))).toBe("90071992547409,93€deplusqu'àlamêmedate");
    cleanup();
    state.pace = { points: [point(1, '1500', '1000')], previousPeriodId: 'p0', gap: '-9007199254740993' };
    show();
    expect(text(screen.getByTestId('pace-gap'))).toBe("90071992547409,93€demoinsqu'àlamêmedate");
  });
});

describe('Infobulle du rythme de dépense', () => {
  it('lit le montant exact, même au-delà de 2^53', () => {
    const data = paceChartData([point(1, '9007199254740993', '-1234'), point(2, '800', null)]);
    expect(text({ textContent: paceTooltipAmount(data[0], 'current') } as HTMLElement)).toBe('90071992547409,93€');
    expect(text({ textContent: paceTooltipAmount(data[0], 'previous') } as HTMLElement)).toBe('-12,34€');
    expect(data[1].previous).toBeNull();
    expect(data[0].day).toBe(1);
    expect(data[1].current).toBe(800);
  });
});

describe('Axes du rythme de dépense', () => {
  const days = (n: number) => Array.from({ length: n }, (_, i) => point(i + 1, String(i * 100), null));

  it('environ 5 repères du premier au dernier jour tracé', () => {
    const ticks = paceTicks(paceChartData(days(24)), 5);
    expect(ticks).toHaveLength(5);
    expect(ticks[0]).toBe(1);
    expect(ticks[ticks.length - 1]).toBe(24);
  });

  it('peu de points : un repère par point, sans doublon', () => {
    expect(paceTicks(paceChartData(days(1)), 5)).toEqual([1]);
    expect(paceTicks(paceChartData(days(3)), 5)).toEqual([1, 2, 3]);
    expect(paceTicks([], 5)).toEqual([]);
  });

  it('l\'échelle verticale inclut le budget quand il dépasse le cumul tracé', () => {
    const data = paceChartData([point(1, '1500', '1000'), point(2, '2000', '1800')]);
    expect(paceYMax(data, '241000')).toBe(241000);
    expect(paceYMax(data, null)).toBe(2000);
    expect(paceYMax(data, '100')).toBe(2000);
  });
});
