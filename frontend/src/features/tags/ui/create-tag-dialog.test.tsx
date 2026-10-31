import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import { CreateTagDialog } from './create-tag-dialog';

const createTag = vi.fn();

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../api/use-create-tag', () => ({ useCreateTag: () => ({ mutate: createTag, isPending: false }) }));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1' }),
}));

function submit() {
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <CreateTagDialog />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: fr.Tags.add_tag }));
  fireEvent.change(screen.getByPlaceholderText(fr.Tags.name_placeholder), { target: { value: 'Tag singe' } });
  fireEvent.click(screen.getByRole('button', { name: fr.Common.save }));
}

describe('CreateTagDialog creation error', () => {
  beforeEach(() => {
    createTag.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('shows the API validation message once', () => {
    createTag.mockImplementation((_vars, opts) =>
      opts.onError?.({ response: { data: { message: ['color must be a hexadecimal color'] } } }),
    );
    submit();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('Le champ « couleur » doit être une couleur hexadécimale (ex. #FF5733)');
  });

  it('falls back to the generic message when the API gave none', () => {
    createTag.mockImplementation((_vars, opts) => opts.onError?.(new Error('Network Error')));
    submit();

    expect(toast.error).toHaveBeenCalledWith(fr.Common.error);
  });
});
