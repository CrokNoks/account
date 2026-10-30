import { render, screen } from '@testing-library/react';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { BulkActionsBar } from './bulk-actions-bar';

const catalogs = { fr, en };

function renderBar(locale: 'fr' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]}>
      <BulkActionsBar selectedCount={2} onClearSelection={() => {}} onBulkDelete={() => {}} onBulkReconcile={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe('BulkActionsBar', () => {
  it('shows French labels', () => {
    renderBar('fr');
    expect(screen.getByText('Sélectionnées')).toBeTruthy();
    expect(screen.getByText('Supprimer')).toBeTruthy();
    expect(screen.getByText('Pointer')).toBeTruthy();
  });

  it('shows English labels', () => {
    renderBar('en');
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Reconcile')).toBeTruthy();
  });
});

describe('bulk messages (ICU plurals)', () => {
  const tFr = createTranslator({ locale: 'fr', messages: fr, namespace: 'Transactions' });
  const tEn = createTranslator({ locale: 'en', messages: en, namespace: 'Transactions' });

  it('pluralises in French', () => {
    expect(tFr('bulk.delete_confirm', { count: 1 })).toBe('Supprimer 1 transaction ?');
    expect(tFr('bulk.delete_confirm', { count: 3 })).toBe('Supprimer 3 transactions ?');
    expect(tFr('bulk.deleted', { count: 3 })).toBe('3 transactions supprimées');
    expect(tFr('bulk.reconciled', { count: 1 })).toBe('1 transaction pointée');
  });

  it('pluralises in English', () => {
    expect(tEn('bulk.delete_confirm', { count: 1 })).toBe('Delete 1 transaction?');
    expect(tEn('bulk.deleted', { count: 3 })).toBe('3 transactions deleted');
    expect(tEn('bulk.reconciled', { count: 1 })).toBe('1 transaction reconciled');
  });
});
