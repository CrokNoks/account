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
// Like the real one: a button that receives the id.
vi.mock('@/features/categories/ui/category-selector', () => ({
  CategorySelector: ({ id }: { id?: string }) => <button id={id} data-testid="category" />,
}));

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

describe('échéance : libellés', () => {
  it('lie chaque libellé visible à son champ', () => {
    renderDialog('fr');
    expect(screen.getByLabelText(fr.Recurring.fields.description)).toHaveAttribute('placeholder', fr.Recurring.description_placeholder);
    expect(screen.getByLabelText(fr.Recurring.fields.category)).toBe(screen.getByTestId("category"));
    expect(screen.getByLabelText(fr.Recurring.fields.day_of_month)).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText(fr.Recurring.fields.amount)).toHaveAttribute('placeholder', '0,00');
  });
});
