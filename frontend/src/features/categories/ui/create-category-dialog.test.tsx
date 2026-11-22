import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { CreateCategoryDialog } from './create-category-dialog';

vi.mock('../api/use-create-category', () => ({
  useCreateCategory: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));

describe('CreateCategoryDialog', () => {
  it('links the visible labels to their fields', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <CreateCategoryDialog />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: fr.Categories.add_category }));

    expect(screen.getByLabelText(fr.Categories.fields.name)).toHaveAttribute('placeholder', fr.Categories.fields.name_placeholder);
    expect(screen.getByLabelText(fr.Categories.fields.type)).toHaveTextContent(fr.Categories.types.expense);
    expect(screen.getByLabelText(fr.Categories.fields.color)).toHaveAttribute('type', 'color');
  });
});
