import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { TagList } from './tag-list';

// Stable reference, like react-query.
const tags = [{ id: 't1', name: 'Vacances', color: '#ff0000' }];
vi.mock('../api/use-tags', () => ({ useTags: () => ({ data: tags, isLoading: false }) }));
vi.mock('../api/use-update-tag', () => ({ useUpdateTag: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock('../api/use-delete-tag', () => ({ useDeleteTag: () => ({ mutate: vi.fn() }) }));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1' }),
}));
vi.mock('@/shared/model/use-ui-store', () => ({
  useUiStore: (selector: (s: { setTagDetailId: () => void }) => unknown) => selector({ setTagDetailId: vi.fn() }),
}));

describe('TagList', () => {
  it('links the labels of the edit drawer to their fields', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <TagList />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByTitle(fr.Common.edit));

    expect(screen.getByLabelText(fr.Tags.fields.name)).toHaveValue('Vacances');
    expect(screen.getByLabelText(fr.Tags.fields.color)).toHaveValue('#ff0000');
  });
});
