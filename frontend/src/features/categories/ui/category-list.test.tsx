import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { CategoryList } from './category-list';
import { CategoryType } from '../model/types';

vi.mock('../api/use-categories', () => ({
  useCategories: () => ({
    data: [{ id: 'c1', name: 'Courses', color: '#000000', type: CategoryType.EXPENSE, accountId: 'a1' }],
    isLoading: false,
  }),
}));
vi.mock('../api/use-update-category', () => ({
  useUpdateCategory: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));

describe('CategoryList', () => {
  // Le plafond de catégorie n'existe plus : le budget est celui de la période.
  it('edits a category without a budget field', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <CategoryList />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Nom')).toBeTruthy();
    expect(screen.getByText('Couleur')).toBeTruthy();
    expect(screen.queryByText(/budget/i)).toBeNull();
  });
});
