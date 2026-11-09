import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { TransactionTable } from './transaction-table';
import { TransactionMobileList } from './transaction-mobile-list';

const tx = (id: string, reconciled: boolean, pending: boolean) => ({
  id, accountId: 'a', categoryId: null, periodId: null, date: '2026-11-02', description: `ligne ${id}`,
  amount: '-1000', reconciled, pending, notes: null, metadata: null, tagIds: [], createdAt: '', updatedAt: '',
});
const rows = [tx('cb', false, false), tx('fa', false, true), tx('ok', true, false), tx('pr', true, true)];

function Screens({ onPoint }: { onPoint: (id: string) => void }) {
  const t = useTranslations('Transactions');
  const common = {
    transactions: rows, selectedIds: [], onToggleSelect: () => {}, onEdit: () => {}, onTagClick: () => {},
    onTogglePointage: (row: { id: string }) => onPoint(row.id), t,
  };
  return (
    <>
      <div data-testid="table"><TransactionTable {...common} onDelete={() => {}} /></div>
      <div data-testid="mobile"><TransactionMobileList {...common} /></div>
    </>
  );
}

const show = (onPoint = vi.fn(), locale: 'fr' | 'en' = 'fr') =>
  render(<NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}><Screens onPoint={onPoint} /></NextIntlClientProvider>);

describe("État écrit des lignes", () => {
  it.each(['table', 'mobile'])('%s : un seul état par ligne, la pending rapprochée est « Pointée »', (id) => {
    show();
    const scope = screen.getByTestId(id);
    const states = [...scope.querySelectorAll('[data-testid^="state-"]')].map((n) => n.textContent);
    expect(states).toEqual(['À pointer', 'Facture à venir', 'Pointée', 'Pointée']);
  });

  it.each(['table', 'mobile'])('%s : pointer en un geste, sans dialogue', (id) => {
    const onPoint = vi.fn();
    show(onPoint);
    const buttons = [...screen.getByTestId(id).querySelectorAll('button[aria-label]')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Pointer', 'Pointer', 'Dépointer', 'Dépointer']);
    fireEvent.click(buttons[1]);
    expect(onPoint).toHaveBeenCalledWith('fa');
  });

  it('est traduit en anglais', () => {
    show(vi.fn(), 'en');
    const states = [...screen.getByTestId('table').querySelectorAll('[data-testid^="state-"]')].map((n) => n.textContent);
    expect(states).toEqual(['To reconcile', 'Upcoming invoice', 'Reconciled', 'Reconciled']);
  });
});
