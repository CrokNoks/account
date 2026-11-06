import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { ToHandle } from './to-handle';

const state = vi.hoisted(() => ({
  stats: { cardCount: 0, cardTotal: '0' } as { cardCount: number; cardTotal: string },
  anomalies: [] as unknown[],
  breakdown: { expenses: [], income: [], savings: [], transfers: [] } as unknown,
}));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('../api/use-reporting-stats', () => ({
  useReportingStats: () => ({ isLoading: false, data: state.stats }),
}));
vi.mock('../api/use-anomalies', () => ({
  useAnomalies: () => ({ isLoading: false, data: state.anomalies }),
}));
vi.mock('../api/use-ignore-anomaly', () => ({ useIgnoreAnomaly: () => ({ mutate: vi.fn() }) }));
vi.mock('../api/use-budget-breakdown', () => ({
  useBudgetBreakdown: () => ({ isLoading: false, data: state.breakdown }),
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const renderBlock = (locale: 'fr' | 'en' = 'fr') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <ToHandle />
    </NextIntlClientProvider>,
  );
const text = () => document.body.textContent!.replace(/\s/g, '');

describe('Bloc À traiter', () => {
  beforeEach(() => {
    state.stats = { cardCount: 0, cardTotal: '0' };
    state.anomalies = [];
    state.breakdown = { expenses: [], income: [], savings: [], transfers: [] };
  });

  it('dit « tout est à jour » sans anomalie, CB à pointer ni dépassement', () => {
    renderBlock();
    expect(screen.getByText('Tout est à jour')).toBeTruthy();
  });

  it('affiche les CB à pointer (nombre et total fournis par les stats du back) et mène aux opérations', () => {
    state.stats = { cardCount: 2, cardTotal: '-1250' };
    renderBlock();

    expect(screen.queryByText('Tout est à jour')).toBeNull();
    expect(text()).toContain('2CBàpointer');
    expect(text()).toContain('-12,50€');
    expect(screen.getByRole('link', { name: /CB à pointer/ }).getAttribute('href')).toBe('/transactions');
  });

  it('liste les dépassements en cours avec le même montant que le bloc Budgets et mène aux budgets', () => {
    state.breakdown = {
      expenses: [{ categoryId: 'e1', name: 'Courses', real: '-60000', budget: '50000', remaining: '-10000', percentage: 120 }],
      income: [],
      savings: [],
      transfers: [],
    };
    renderBlock();

    expect(text()).toContain('Courses');
    expect(text()).toContain('100,00€');
    expect(screen.getByRole('link', { name: /Courses/ }).getAttribute('href')).toBe('/budgets');
  });

  it('liste les anomalies avec un lien vers les opérations', () => {
    state.anomalies = [
      { id: 'an-1', type: 'duplicate', severity: 'high', title: 'Doublon', description: 'Deux fois', transactionIds: ['t1'] },
    ];
    renderBlock();

    expect(screen.getByRole('link', { name: 'Doublon' }).getAttribute('href')).toBe('/transactions');
    expect(screen.queryByText('Tout est à jour')).toBeNull();
  });

  it('est traduit en anglais', () => {
    renderBlock('en');
    expect(screen.getByText('To handle')).toBeTruthy();
    expect(screen.getByText('All up to date')).toBeTruthy();
  });
});
