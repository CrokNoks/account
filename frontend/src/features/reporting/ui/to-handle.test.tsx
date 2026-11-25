import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { ToHandle } from './to-handle';

const state = vi.hoisted(() => ({
  stats: { cardCount: 0, cardTotal: '0' } as { cardCount: number; cardTotal: string },
  anomalies: [] as unknown[],
  status: {} as { target?: string; loading?: boolean; error?: boolean },
  breakdown: { expenses: [], income: [], savings: [], transfers: [] } as unknown,
  categories: [] as Array<{ id: string; name: string; isPeriodTrigger?: boolean }>,
  periods: [{ id: 'p1', startDate: '2026-11-01', endDate: '2026-11-30', isActive: true }] as unknown[],
  pending: [] as unknown[],
  pendingQuery: vi.fn(),
}));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('../api/use-reporting-stats', () => ({
  useReportingStats: () => state.status.target === 'stats' ? { isLoading: !!state.status.loading, isError: !!state.status.error, data: undefined } : { isLoading: false, isError: false, data: state.stats },
}));
vi.mock('../api/use-anomalies', () => ({
  useAnomalies: () => state.status.target === 'anomalies' ? { isLoading: !!state.status.loading, isError: !!state.status.error, data: undefined } : { isLoading: false, isError: false, data: state.anomalies },
}));
vi.mock('../api/use-ignore-anomaly', () => ({ useIgnoreAnomaly: () => ({ mutate: vi.fn() }) }));
vi.mock('../api/use-budget-breakdown', () => ({
  useBudgetBreakdown: () => state.status.target === 'breakdown' ? { isLoading: !!state.status.loading, isError: !!state.status.error, data: undefined } : { isLoading: false, isError: false, data: state.breakdown },
}));
vi.mock('@/features/categories/api/use-categories', () => ({
  useCategories: () => ({ data: state.categories, isLoading: state.status.target === 'categories' && !!state.status.loading, isError: state.status.target === 'categories' && !!state.status.error }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({
  usePeriods: () => ({ data: state.periods, isLoading: false, isError: false }),
}));
vi.mock('@/features/transactions/api/use-transactions', () => ({
  useTransactions: (accountId: string | null, options: unknown) => {
    state.pendingQuery(accountId, options);
    return { data: { data: state.pending, meta: {} }, isLoading: false, isError: false };
  },
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
    state.status = {};
    state.categories = [];
    state.periods = [{ id: 'p1', startDate: '2026-11-01', endDate: '2026-11-30', isActive: true }];
    state.pending = [];
    state.pendingQuery.mockClear();
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
    expect(screen.getByRole('link', { name: /CB à pointer/ }).getAttribute('href')).toBe('/transactions?state=a_pointer');
  });

  it('liste les dépassements en cours avec le même montant que le bloc Budgets et mène aux opérations de la catégorie', () => {
    state.breakdown = {
      expenses: [{ categoryId: 'e1', name: 'Courses', real: '-60000', budget: '50000', remaining: '-10000', percentage: 120 }],
      income: [],
      savings: [],
      transfers: [],
    };
    renderBlock();

    expect(text()).toContain('Courses');
    expect(text()).toContain('100,00€');
    expect(screen.getByRole('link', { name: /Courses/ }).getAttribute('href')).toBe('/transactions?categoryId=e1');
  });

  it('liste les anomalies avec un lien vers les opérations', () => {
    state.anomalies = [
      { id: 'an-1', type: 'duplicate', severity: 'high', title: 'Doublon', description: 'Deux fois', transactionIds: ['t1', 't2'] },
    ];
    renderBlock();

    const href = screen.getByRole('link', { name: 'Doublon' }).getAttribute('href')!;
    const params = new URL(href, 'http://x').searchParams;
    expect(href.startsWith('/transactions?')).toBe(true);
    expect(params.get('ids')).toBe('t1,t2');
    expect(params.get('period')).toBe('all');
    expect(params.get('state')).toBeNull();
    expect(screen.queryByText('Tout est à jour')).toBeNull();
  });

  it.each(['stats', 'anomalies', 'breakdown'])(
    'n\'affiche pas « Tout est à jour » pendant le chargement de %s',
    (target) => {
      state.status = { target, loading: true };
      renderBlock();
      expect(screen.queryByText('Tout est à jour')).toBeNull();
      expect(screen.getByText('Chargement…')).toBeTruthy();
    },
  );

  it.each(['stats', 'anomalies', 'breakdown'])(
    'montre une erreur visible, sans « Tout est à jour », si %s échoue',
    (target) => {
      state.status = { target, error: true };
      renderBlock();
      expect(screen.queryByText('Tout est à jour')).toBeNull();
      expect(screen.getByRole('alert').textContent).toContain('Impossible de charger');
    },
  );

  it('est traduit en anglais', () => {
    renderBlock('en');
    expect(screen.getByText('To handle')).toBeTruthy();
    expect(screen.getByText('All up to date')).toBeTruthy();
  });

  describe('prochaine paie (déclencheur de période)', () => {
    const salary = (id: string, date: string) => ({
      id, description: 'Salaire Exemple', amount: '250000', date: `${date}T00:00:00.000Z`, pending: true, categoryId: 'c-sal',
    });

    beforeEach(() => {
      state.categories = [
        { id: 'c-sal', name: 'Salaire', isPeriodTrigger: true },
        { id: 'c-other', name: 'Courses' },
      ];
    });

    it('signale la paie en pending datée après la fin de la période active et mène à ses opérations, toutes périodes', () => {
      state.pending = [salary('pay-1', '2026-12-01')];
      renderBlock();

      expect(screen.queryByText('Tout est à jour')).toBeNull();
      expect(text()).toContain('SalaireExemple');
      expect(text()).toContain('01/12/2026');
      expect(text()).toContain('2500,00€');
      const href = screen.getByRole('link', { name: /Salaire Exemple/ }).getAttribute('href')!;
      const params = new URL(href, 'http://x').searchParams;
      expect(params.get('ids')).toBe('pay-1');
      expect(params.get('period')).toBe('all');
    });

    it('lit la liste existante : catégorie déclencheuse, pending, sans fenêtre de période', () => {
      renderBlock();

      expect(state.pendingQuery).toHaveBeenCalledWith('a1', expect.objectContaining({ categoryId: 'c-sal', pending: true }));
      expect(state.pendingQuery.mock.calls.at(-1)![1]).not.toHaveProperty('periodId');
    });

    it('ne signale rien sans pending, et « tout est à jour » reste vrai', () => {
      renderBlock();

      expect(screen.getByText('Tout est à jour')).toBeTruthy();
      expect(screen.queryByText(/Salaire Exemple/)).toBeNull();
    });

    it('ignore une paie pending encore dans la période active (fin comprise)', () => {
      state.pending = [salary('pay-1', '2026-11-30'), salary('pay-2', '2026-11-12')];
      renderBlock();

      expect(screen.queryByText(/Salaire Exemple/)).toBeNull();
      expect(screen.getByText('Tout est à jour')).toBeTruthy();
    });

    it('prend la plus proche quand plusieurs paies sont en attente', () => {
      state.pending = [salary('later', '2027-01-28'), salary('near', '2026-12-28')];
      renderBlock();

      const links = screen.getAllByRole('link', { name: /Salaire Exemple/ });
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute('href')).toContain('ids=near');
    });

    it('ne lit rien tant qu\'aucune catégorie n\'est déclencheuse (réglage vide par défaut)', () => {
      state.categories = [{ id: 'c-sal', name: 'Salaire' }];
      state.pending = [salary('pay-1', '2026-12-01')];
      renderBlock();

      expect(state.pendingQuery.mock.calls.every(([, options]) => (options as { categoryId?: string }).categoryId === undefined)).toBe(true);
      expect(screen.queryByText(/Salaire Exemple/)).toBeNull();
      expect(screen.getByText('Tout est à jour')).toBeTruthy();
    });

    it('est traduit en anglais', () => {
      state.pending = [salary('pay-1', '2026-12-01')];
      renderBlock('en');

      expect(text()).toContain('Toreconcileonarrival');
      expect(text()).toContain('12/01/2026');
    });
  });
});
