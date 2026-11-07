import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { UpcomingDeadlinesWidget } from './upcoming-deadlines-widget';

const events = vi.hoisted(() => ({
  list: [] as unknown[],
  /** Mois suivant, lu par un second appel (`${année}-${mois}`). */
  byMonth: {} as Record<string, { data?: unknown[]; isError?: boolean }>,
  asked: [] as string[],
}));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1', activePeriodId: 'p1' }),
}));
vi.mock('../api/use-calendar-data', () => ({
  useCalendarData: (_a: string, year: number, month: number) => {
    const key = `${year}-${month}`;
    events.asked.push(key);
    const other = events.byMonth[key];
    if (other) return { isLoading: false, isError: !!other.isError, data: other.data };
    return { isLoading: false, isError: false, data: events.list };
  },
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
    events.byMonth = {};
    events.asked = [];
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
    expect(text()).toContain('Totaldes2échéancesaffichées');
    expect(text()).toContain('-860,00€');
    expect(text()).not.toContain('autresnoncomprises');
  });

  it('au-delà de 5 échéances dans les 7 jours, dit combien d\'autres ne sont pas comprises dans le total', () => {
    events.list = [11, 12, 13, 14, 15, 16, 17].map((d) => ({
      id: `e${d}`, date: `2026-11-${d}`, description: `Facture ${d}`, amount: '-1000', type: 'actual', categoryId: null,
    }));
    renderWidget();

    expect(text()).toContain('Totaldes5échéancesaffichées');
    expect(text()).toContain('-50,00€');
    expect(text()).toContain('2autresnoncomprises');
  });

  it('le 28, montre aussi les échéances du mois suivant et les compte dans « autres »', () => {
    vi.setSystemTime(new Date(2026, 10, 28, 12));
    events.list = [
      { id: 'a', date: '2026-11-29', description: 'Mobile', amount: '-1000', type: 'recurring', categoryId: null },
    ];
    events.byMonth['2026-12'] = {
      data: [
        { id: 'b', date: '2026-12-02', description: 'Assurance', amount: '-5800', type: 'recurring', categoryId: null },
        { id: 'c', date: '2026-12-20', description: 'Hors fenêtre', amount: '-1', type: 'recurring', categoryId: null },
      ],
    };
    renderWidget();

    expect(events.asked).toContain('2026-12');
    expect(text()).toContain('Mobile');
    expect(text()).toContain('Assurance');
    expect(text()).not.toContain('Horsfenêtre');
    expect(text()).toContain('-68,00€');
  });

  it('en fin d\'année, lit janvier de l\'année suivante', () => {
    vi.setSystemTime(new Date(2026, 11, 29, 12));
    events.list = [];
    events.byMonth['2027-1'] = {
      data: [{ id: 'j', date: '2027-01-02', description: 'Loyer janvier', amount: '-85000', type: 'recurring', categoryId: null }],
    };
    renderWidget();

    expect(events.asked).toContain('2027-1');
    expect(text()).toContain('Loyerjanvier');
  });

  it('les « autres non comprises » comptent aussi celles du mois suivant', () => {
    vi.setSystemTime(new Date(2026, 10, 28, 12));
    events.list = [29, 30].map((d) => ({
      id: `n${d}`, date: `2026-11-${d}`, description: `Nov ${d}`, amount: '-100', type: 'actual', categoryId: null,
    }));
    events.byMonth['2026-12'] = {
      data: [1, 2, 3, 4].map((d) => ({
        id: `d${d}`, date: `2026-12-0${d}`, description: `Déc ${d}`, amount: '-100', type: 'actual', categoryId: null,
      })),
    };
    renderWidget();

    expect(text()).toContain('1autrenoncomprise');
  });

  it('un échec du mois suivant ne masque pas le mois en cours et le dit discrètement', () => {
    vi.setSystemTime(new Date(2026, 10, 28, 12));
    events.list = [
      { id: 'a', date: '2026-11-29', description: 'Mobile', amount: '-1000', type: 'recurring', categoryId: null },
    ];
    events.byMonth['2026-12'] = { isError: true };
    renderWidget();

    expect(text()).toContain('Mobile');
    expect(text()).toContain('-10,00€');
    expect(text()).toContain('moissuivant');
  });

  it('ne lit pas de second mois quand la fenêtre reste dans le mois', () => {
    events.list = [];
    renderWidget();
    expect(new Set(events.asked)).toEqual(new Set(['2026-11']));
  });

  it('n\'affiche pas de total sans échéance', () => {
    events.list = [];
    renderWidget();

    expect(text()).toContain('Rien de prévu cette semaine'.replace(/\s/g, ''));
    expect(text()).not.toContain('Total');
  });
});
