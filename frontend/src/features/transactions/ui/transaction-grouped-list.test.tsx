import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { TransactionTable } from './transaction-table';
import { TransactionMobileList } from './transaction-mobile-list';
import type { Transaction } from '../model/types';

vi.mock('@/features/reporting/lib/signed-amount', () => ({
  usePresentAmount: () => (amount: string) => ({ text: amount, className: '' }),
}));

const tx = (id: string, date: string, extra: Partial<Transaction> = {}) =>
  ({ id, date, description: `desc ${id}`, amount: '-1000', reconciled: false, pending: false, tagIds: [], ...extra }) as unknown as Transaction;

// Fin de page 1 et début de page 2 : le 5 nov. est coupé entre deux pages.
const page1 = [tx('a', '2026-11-06T00:00:00.000Z'), tx('b', '2026-11-06T00:00:00.000Z'), tx('c', '2026-11-05T00:00:00.000Z')];
const page2 = [tx('d', '2026-11-05T00:00:00.000Z'), tx('e', '2026-11-04T00:00:00.000Z')];

function Wrapper({ locale, children }: { locale: 'fr' | 'en'; children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

const noop = () => {};
function table(rows: Transaction[], extra: Record<string, unknown> = {}) {
  const t = (key: string) => key;
  return (
    <TransactionTable
      transactions={rows} selectedIds={[]} onToggleSelect={noop} onEdit={noop} onDelete={noop}
      onTogglePointage={noop} onTagClick={noop} t={t as never} {...extra}
    />
  );
}
function mobile(rows: Transaction[], extra: Record<string, unknown> = {}) {
  const t = (key: string) => key;
  return (
    <TransactionMobileList
      transactions={rows} selectedIds={[]} onToggleSelect={noop} onEdit={noop}
      onTogglePointage={noop} onTagClick={noop} t={t as never} {...extra}
    />
  );
}

describe('Opérations bureau : un en-tête par jour, plus de colonne Date', () => {
  it('place l\'en-tête de chaque jour avant ses lignes, du plus récent au plus ancien', () => {
    render(<Wrapper locale="fr">{table(page1)}</Wrapper>);
    const order = screen
      .getAllByRole('row')
      .map((r) => r.textContent ?? '')
      .filter((r) => /^\d+ nov\.$/.test(r) || /desc [a-e]/.test(r))
      .map((r) => (/desc [a-e]/.test(r) ? r.match(/desc [a-e]/)![0] : r));
    expect(order).toEqual(['6 nov.', 'desc a', 'desc b', '5 nov.', 'desc c']);
    expect(screen.queryByText('fields.date')).toBeNull();
  });

  it('en anglais, la date courte suit la langue', () => {
    render(<Wrapper locale="en">{table(page1)}</Wrapper>);
    expect(screen.getAllByTestId('day-heading').map((h) => h.textContent)).toEqual(['Nov 6', 'Nov 5']);
  });

  it('un jour coupé entre deux pages reprend son en-tête sur la page suivante', () => {
    const { unmount } = render(<Wrapper locale="fr">{table(page1)}</Wrapper>);
    expect(screen.getAllByTestId('day-heading').map((h) => h.textContent)).toEqual(['6 nov.', '5 nov.']);
    unmount();
    render(<Wrapper locale="fr">{table(page2)}</Wrapper>);
    expect(screen.getAllByTestId('day-heading').map((h) => h.textContent)).toEqual(['5 nov.', '4 nov.']);
  });

  it('conserve les actions de ligne : sélection (case), pointage, modification', () => {
    const onToggleSelect = vi.fn();
    const onTogglePointage = vi.fn();
    const onEdit = vi.fn();
    render(<Wrapper locale="fr">{table(page1, { onToggleSelect, onTogglePointage, onEdit })}</Wrapper>);
    const row = screen.getByText('desc b').closest('tr')!;
    fireEvent.click(within(row).getAllByRole('checkbox')[0]);
    expect(onToggleSelect).toHaveBeenCalledWith('b');
    fireEvent.click(within(row).getByRole('button', { name: 'point' }));
    expect(onTogglePointage).toHaveBeenCalledWith(page1[1]);
    fireEvent.click(screen.getByText('desc c'));
    expect(onEdit).toHaveBeenCalledWith(page1[2]);
  });

  it('une page vide affiche le message vide, sans en-tête de jour', () => {
    render(<Wrapper locale="fr">{table([])}</Wrapper>);
    expect(screen.getByText('empty')).toBeTruthy();
    expect(screen.queryByTestId('day-heading')).toBeNull();
  });
});

describe('Opérations mobile : mêmes en-têtes, date non répétée sur la carte', () => {
  it('sépare les cartes par un en-tête de jour et ne répète pas la date', () => {
    const { container } = render(<Wrapper locale="fr">{mobile(page1)}</Wrapper>);
    expect(screen.getAllByTestId('day-heading').map((h) => h.textContent)).toEqual(['6 nov.', '5 nov.']);
    // la date n'apparaît qu'une fois par jour : 2 occurrences au total pour 3 cartes
    expect(container.textContent!.match(/nov\./g)).toHaveLength(2);
  });

  it('conserve le pointage et la sélection d\'une carte', () => {
    const onToggleSelect = vi.fn();
    const onTogglePointage = vi.fn();
    render(<Wrapper locale="fr">{mobile(page1, { onToggleSelect, onTogglePointage })}</Wrapper>);
    const card = screen.getByText('desc a').closest('div[class*="rounded-xl"]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'point' }));
    expect(onTogglePointage).toHaveBeenCalledWith(page1[0]);
    fireEvent.click(within(card).getByRole('checkbox'));
    expect(onToggleSelect).toHaveBeenCalledWith('a');
  });
});
