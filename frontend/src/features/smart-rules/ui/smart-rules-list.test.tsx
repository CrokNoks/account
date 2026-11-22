import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { SmartRulesList } from './smart-rules-list';

// Stable references, like react-query.
const rules = [{ id: 'r1', accountId: 'a1', pattern: 'NETFLIX', categoryId: null, tagIds: [], priority: 3, createdAt: '', updatedAt: '' }];
const noData = { data: [] as never[], isLoading: false };
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));
vi.mock('@/features/tags/api/use-tags', () => ({ useTags: () => noData }));
vi.mock('@/features/categories/api/use-categories', () => ({ useCategories: () => noData }));
vi.mock('../api/use-smart-rules', () => ({
  useSmartRules: () => ({ data: rules, isLoading: false }),
  useDeleteSmartRule: () => ({ mutate: vi.fn() }),
  useUpdateSmartRule: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('SmartRulesList', () => {
  it('links the labels of the edit drawer to their fields', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <SmartRulesList />
      </NextIntlClientProvider>,
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 2]); // pencil, just before the trash

    expect(screen.getByLabelText(fr.SmartRules.fields.pattern)).toHaveValue('NETFLIX');
    expect(screen.getByLabelText(fr.SmartRules.fields.category).getAttribute('role')).toBe('combobox');
    expect(screen.getByLabelText(fr.SmartRules.fields.priority)).toHaveValue(3);
  });
});
