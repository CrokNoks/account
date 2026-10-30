import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { CreateAccountDialog } from './create-account-dialog';

const createAccount = vi.fn();

vi.mock('../api/use-create-account', () => ({
  useCreateAccount: () => ({ mutate: createAccount, isPending: false }),
}));
vi.mock('@/shared/model/use-ui-store', () => ({
  useUiStore: () => ({
    isCreateAccountDialogOpen: true,
    setCreateAccountDialogOpen: vi.fn(),
  }),
}));

describe('CreateAccountDialog', () => {
  it('sends only the fields the API accepts (no type, no currency)', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <CreateAccountDialog />
      </NextIntlClientProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText(/Compte courant/), {
      target: { value: 'Courant' },
    });
    fireEvent.click(screen.getByRole('button', { name: fr.Common.add }));

    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(createAccount.mock.calls[0][0]).toEqual({
      name: 'Courant',
      description: '',
      initialBalance: '0',
    });
  });
});
