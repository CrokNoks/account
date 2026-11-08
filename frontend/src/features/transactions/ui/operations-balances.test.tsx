import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { OperationsBalances } from './operations-balances';

const state = vi.hoisted(() => ({
  stats: undefined as unknown,
  lastPeriod: undefined as unknown,
}));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('@/features/reporting/api/use-reporting-stats', () => ({
  useReportingStats: (_account: string, period: string | null) => {
    state.lastPeriod = period;
    return { isLoading: false, data: period ? state.stats : undefined };
  },
}));

const renderBalances = (hasPeriod: boolean, locale: 'fr' | 'en' = 'fr') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <OperationsBalances hasPeriod={hasPeriod} />
    </NextIntlClientProvider>,
  );
const text = (id: string) => screen.getByTestId(id).textContent!.replace(/\s/g, '');

describe('Soldes de tête des opérations', () => {
  beforeEach(() => {
    state.stats = { realBankBalance: '340000', upcomingBalance: '-1500', cardTotal: '-1250', cardCount: 2 };
  });

  it('reprend en banque, à venir et reste à pointer des stats de la période', () => {
    renderBalances(true);

    expect(state.lastPeriod).toBe('p1');
    expect(text('balance-bank')).toContain('3400,00');
    expect(text('balance-upcoming')).toContain('-15,00');
    expect(text('balance-to-reconcile')).toContain('-12,50');
    expect(text('balance-to-reconcile')).toContain('2CB');
  });

  it('met un solde négatif en orange (avec son « - ») et les autres en encre, jamais en vert ni en rouge', () => {
    renderBalances(true);

    const amount = (id: string) => screen.getByTestId(id).querySelector('p.font-black')!.className;
    expect(amount('balance-bank')).toContain('text-foreground');
    expect(amount('balance-upcoming')).toContain('text-warn');
    expect(amount('balance-to-reconcile')).toContain('text-warn');
    for (const id of ['balance-bank', 'balance-upcoming', 'balance-to-reconcile']) {
      expect(amount(id)).not.toMatch(/text-(red|green)/);
    }
  });

  it("explique l'absence de soldes sans période, sans interroger les stats", () => {
    renderBalances(false);

    expect(state.lastPeriod).toBeNull();
    expect(screen.getByTestId('balances-no-period').textContent).toContain('période');
    expect(screen.queryByTestId('balance-bank')).toBeNull();
  });

  it('est traduit en anglais', () => {
    renderBalances(true, 'en');
    expect(screen.getByTestId('balance-to-reconcile').textContent).toContain('Left to reconcile');
  });
});
