import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateAccountDialog } from './create-account-dialog';

const createAccount = vi.fn();

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
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
    render(<CreateAccountDialog />);

    fireEvent.change(screen.getByPlaceholderText(/Checking Account/), {
      target: { value: 'Courant' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(createAccount.mock.calls[0][0]).toEqual({
      name: 'Courant',
      description: '',
      initialBalance: '0',
    });
  });
});
