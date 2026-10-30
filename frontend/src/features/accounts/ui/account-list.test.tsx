import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountList } from './account-list';

const accounts = [
  { id: 'a1', name: 'Mon compte', ownerId: 'me', description: null, initialBalance: '1000' },
  { id: 'a2', name: 'Compte partagé', ownerId: 'someone-else', description: null, initialBalance: '2000' },
];
let currentUserId: string | undefined;

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('../api/use-accounts', () => ({
  useAccounts: () => ({ data: accounts, isLoading: false }),
}));
vi.mock('../api/use-update-account', () => ({
  useUpdateAccount: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/auth/api/use-current-user-id', () => ({
  useCurrentUserId: () => currentUserId,
}));

describe('AccountList', () => {
  beforeEach(() => {
    currentUserId = 'me';
  });

  it('shows share and edit actions only on the accounts owned by the current user', () => {
    render(<AccountList />);

    expect(screen.getAllByLabelText('share-account')).toHaveLength(1);
    expect(screen.getAllByLabelText('edit-account')).toHaveLength(1);
    expect(screen.getByText('Compte partagé')).toBeTruthy();
  });

  it('shows no action on any account when every account is shared with the user', () => {
    currentUserId = 'third-party';
    render(<AccountList />);

    expect(screen.queryAllByLabelText('share-account')).toHaveLength(0);
    expect(screen.queryAllByLabelText('edit-account')).toHaveLength(0);
  });

  it('shows no action while the current user is still unknown', () => {
    currentUserId = undefined;
    render(<AccountList />);

    expect(screen.queryAllByLabelText('share-account')).toHaveLength(0);
  });
});
