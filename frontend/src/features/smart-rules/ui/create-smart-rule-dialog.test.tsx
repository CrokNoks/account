import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { CreateSmartRuleDialog } from './create-smart-rule-dialog';

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));
vi.mock('@/features/tags/api/use-tags', () => ({ useTags: () => ({ data: [] }) }));
vi.mock('@/features/categories/api/use-categories', () => ({ useCategories: () => ({ data: [], isLoading: false }) }));
vi.mock('../api/use-smart-rules', () => ({
  useCreateSmartRule: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('CreateSmartRuleDialog', () => {
  it('links the visible labels to their fields', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <CreateSmartRuleDialog />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: fr.SmartRules.add_rule }));

    expect(screen.getByLabelText(fr.SmartRules.fields.pattern)).toHaveAttribute('placeholder', fr.SmartRules.pattern_placeholder);
    expect(screen.getByLabelText(fr.SmartRules.fields.category).getAttribute('role')).toBe('combobox');
    expect(screen.getByLabelText(fr.SmartRules.fields.priority)).toHaveValue(0);
  });
});
