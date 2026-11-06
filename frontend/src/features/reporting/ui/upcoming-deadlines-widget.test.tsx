import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { UpcomingDeadlinesWidget } from './upcoming-deadlines-widget';

const events = vi.hoisted(() => ({ list: [] as unknown[] }));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('../api/use-calendar-data', () => ({
  useCalendarData: () => ({ isLoading: false, data: events.list }),
}));

const text = () => document.body.textContent!.replace(/\s/g, '');
const renderWidget = () =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <UpcomingDeadlinesWidget />
    </NextIntlClientProvider>,
  );

describe('Bloc Factures (prochaines échéances)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('affiche date, libellé, montant et le total des échéances à 7 jours', () => {
    events.list = [
      { id: 'e1', date: '2026-11-12', description: 'Loyer', amount: '-80000', type: 'recurring', categoryId: null },
      { id: 'e2', date: '2026-11-14', description: 'Électricité', amount: '-6000', type: 'actual', categoryId: null },
      { id: 'e3', date: '2026-11-30', description: 'Trop loin', amount: '-1000', type: 'actual', categoryId: null },
    ];
    renderWidget();

    expect(text()).toContain('Loyer');
    expect(text()).toContain('-800,00€');
    expect(text()).toContain('Électricité');
    expect(text()).not.toContain('Troploin');
    expect(text()).toContain('Total');
    expect(text()).toContain('-860,00€');
  });

  it('n\'affiche pas de total sans échéance', () => {
    events.list = [];
    renderWidget();

    expect(text()).toContain('Rien de prévu cette semaine'.replace(/\s/g, ''));
    expect(text()).not.toContain('Total');
  });
});
