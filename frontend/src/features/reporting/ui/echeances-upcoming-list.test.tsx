import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { EcheancesUpcomingList } from './echeances-upcoming-list';

const state = vi.hoisted(() => ({ list: [] as unknown[], isError: false }));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));
vi.mock('../api/use-calendar-data', () => ({
  useCalendarData: () => ({ isLoading: false, isError: state.isError, data: state.isError ? undefined : state.list }),
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));

const ev = (id: string, date: string, description: string, amount: string, type: string, pending?: boolean) => ({
  id, date, description, amount, type, categoryId: null, ...(pending === undefined ? {} : { pending }),
});
const norm = () => document.body.textContent!.replace(/[  ]/g, ' ');
const renderList = (month: Date) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <EcheancesUpcomingList currentDate={month} />
    </NextIntlClientProvider>,
  );

describe('Liste « À venir en {mois} »', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 12));
    state.isError = false;
  });
  afterEach(() => vi.useRealTimers());

  it("donne les échéances d'aujourd'hui et des jours suivants, par date, avec état et montant signé", () => {
    state.list = [
      ev('late', '2026-11-25', 'Salaire', '320000', 'recurring'),
      ev('past', '2026-11-03', 'Courses', '-4500', 'actual'),
      ev('today', '2026-11-10', 'Internet', '-4000', 'recurring'),
      ev('bill', '2026-11-12', 'Électricité', '-9200', 'actual', true),
    ];
    renderList(new Date(2026, 10, 15));

    const items = screen.getAllByRole('listitem').map((li) => li.textContent!.replace(/[  ]/g, ' '));
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('Internet');
    expect(items[0]).toContain('Prévue');
    expect(items[0]).toContain('10 nov.');
    expect(items[0]).toContain('-40,00 €');
    expect(items[1]).toContain('Électricité');
    expect(items[1]).toContain('Facture en attente');
    expect(items[2]).toContain('Salaire');
    expect(items[2]).toContain('+3 200,00 €');
    expect(norm()).not.toContain('Courses');
    expect(screen.getByRole('heading', { name: 'À venir en novembre' })).toBeTruthy();
  });

  it("écrit les montants en encre : le sens se lit au signe, pas à la couleur", () => {
    state.list = [
      ev('in', '2026-11-25', 'Salaire', '320000', 'recurring'),
      ev('out', '2026-11-26', 'Internet', '-4000', 'recurring'),
    ];
    renderList(new Date(2026, 10, 15));

    for (const amount of [screen.getByText(/\+3\s?200,00/), screen.getByText(/-40,00/)]) {
      expect(amount.className).toContain('text-foreground');
      expect(amount.className).not.toMatch(/text-(red|green|primary)/);
    }
  });

  it('ouvre /recurring avec « Gérer les récurrences »', () => {
    state.list = [];
    renderList(new Date(2026, 10, 15));
    expect(screen.getByRole('link', { name: 'Gérer les récurrences' }).getAttribute('href')).toBe('/recurring');
  });

  it('dit que rien ne reste à venir sur un mois sans échéance', () => {
    state.list = [];
    renderList(new Date(2026, 10, 15));
    expect(norm()).toContain('Aucune échéance à venir en novembre');
  });

  it('sur un mois passé, dit que le mois est terminé', () => {
    state.list = [ev('x', '2026-10-05', 'Loyer', '-85000', 'actual')];
    renderList(new Date(2026, 9, 15));
    expect(norm()).toContain('Ce mois est passé');
    expect(norm()).not.toContain('Loyer');
  });

  it('une erreur de chargement donne un message dans le bloc', () => {
    state.isError = true;
    renderList(new Date(2026, 10, 15));
    expect(screen.getByRole('alert').textContent).toContain('échéances');
  });
});
