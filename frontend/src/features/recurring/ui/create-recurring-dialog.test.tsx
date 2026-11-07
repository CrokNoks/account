import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { CreateRecurringDialog } from './create-recurring-dialog';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/accounts/model/use-account-store', () => ({ useAccountStore: () => ({ activeAccountId: 'a' }) }));
vi.mock('../api/use-create-recurring-transaction', () => ({
  useCreateRecurringTransaction: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/categories/ui/category-selector', () => ({ CategorySelector: () => <div /> }));

const renderDialog = (locale: 'fr' | 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <CreateRecurringDialog open onOpenChange={vi.fn()} />
    </NextIntlClientProvider>,
  );

describe('échéance : montant vide', () => {
  it('suit la langue : 0,00 en fr', () => {
    renderDialog('fr');
    expect(screen.getByPlaceholderText('0,00')).toBeTruthy();
  });
  it('0.00 en en', () => {
    renderDialog('en');
    expect(screen.getByPlaceholderText('0.00')).toBeTruthy();
  });
});
