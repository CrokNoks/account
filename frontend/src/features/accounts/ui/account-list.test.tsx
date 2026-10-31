import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { AccountList } from './account-list';

const accounts = [
  { id: 'a1', name: 'Mon compte', ownerId: 'me', initialBalance: '1000' },
  { id: 'a2', name: 'Compte partagé', ownerId: 'someone-else', initialBalance: '2000' },
];
let currentUserId: string | undefined;

vi.mock('../api/use-accounts', () => ({
  useAccounts: () => ({ data: accounts, isLoading: false }),
}));
vi.mock('../api/use-update-account', () => ({
  useUpdateAccount: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/auth/api/use-current-user-id', () => ({
  useCurrentUserId: () => currentUserId,
}));

function renderList() {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <AccountList />
    </NextIntlClientProvider>,
  );
}

describe('AccountList', () => {
  beforeEach(() => {
    currentUserId = 'me';
  });

  it('shows share and edit actions only on the accounts owned by the current user', () => {
    renderList();

    expect(screen.getAllByLabelText('Partager')).toHaveLength(1);
    expect(screen.getAllByLabelText('Modifier')).toHaveLength(1);
    expect(screen.getByText('Compte partagé')).toBeTruthy();
  });

  it('shows no action on any account when every account is shared with the user', () => {
    currentUserId = 'third-party';
    renderList();

    expect(screen.queryAllByLabelText('Partager')).toHaveLength(0);
    expect(screen.queryAllByLabelText('Modifier')).toHaveLength(0);
  });

  it('shows no action while the current user is still unknown', () => {
    currentUserId = undefined;
    renderList();

    expect(screen.queryAllByLabelText('Partager')).toHaveLength(0);
  });
});
