import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import { ShareAccountDialog } from './share-account-dialog';

const share = vi.fn();

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../api/use-account-shares', () => ({
  useAccountShares: () => ({ data: [], isLoading: false }),
}));
vi.mock('../api/use-manage-share', () => ({
  useManageShare: () => ({ share, isSharing: false, remove: vi.fn(), isRemoving: false }),
}));

function submitShare() {
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <ShareAccountDialog accountId="acc-1" accountName="Courant" open onOpenChange={() => {}} />
    </NextIntlClientProvider>,
  );
  fireEvent.change(screen.getByPlaceholderText(fr.Accounts.share_email_placeholder), {
    target: { value: 'friend@example.com' },
  });
  fireEvent.submit(screen.getByPlaceholderText(fr.Accounts.share_email_placeholder).closest('form')!);
}

describe('ShareAccountDialog share error', () => {
  beforeEach(() => {
    share.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('shows the API message once', () => {
    share.mockImplementation((_vars, opts) =>
      opts.onError({ response: { data: { message: ['email must be an email', 'permission must be one of the following values: read, write'] } } }),
    );
    submitShare();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('Le champ « e-mail » doit être une adresse e-mail valide · Le champ « permission » a une valeur non autorisée');
  });

  it('falls back to the generic translated message when the API gave none', () => {
    share.mockImplementation((_vars, opts) => opts.onError(new Error('Network Error')));
    submitShare();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(fr.Common.error);
  });
});
