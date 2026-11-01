import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { EvolutionChart } from './evolution-chart';

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1' }),
}));
vi.mock('@/features/categories/api/use-categories', () => ({
  useCategories: () => ({
    isLoading: false,
    data: [{ id: 'c1', name: 'Courses', type: 'expense' }],
  }),
}));
vi.mock('../api/use-evolution', () => ({
  useEvolution: () => ({
    isLoading: false,
    data: [
      {
        startDate: '2026-01-01T00:00:00.000Z',
        isActive: false,
        realBankBalance: '100000',
        realIncome: '200000',
        realExpenses: '-150000',
        categories: { c1: '-5000' },
      },
    ],
  }),
}));

describe('EvolutionChart', () => {
  it('does not warn about charts without size on first render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <EvolutionChart />
      </NextIntlClientProvider>,
    );

    const sizeWarnings = warn.mock.calls.filter((c) => String(c[0]).includes('of chart should be greater than 0'));
    expect(sizeWarnings).toEqual([]);
  });
});
