import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import { apiClient } from '@/shared/api/api-client';
import { RecurringTransactionList } from './recurring-transaction-list';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/shared/api/api-client', () => ({ apiClient: { delete: vi.fn() } }));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1' }),
}));
vi.mock('@/features/categories/api/use-categories', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('../api/use-recurring-transactions', () => ({
  useRecurringTransactions: () => ({
    isLoading: false,
    data: [{ id: 'r1', description: 'Netflix', amount: '-1500', categoryId: null, dayOfMonth: 5 }],
  }),
}));

describe('RecurringTransactionList delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', () => true);
  });

  it('shows a single success toast', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <QueryClientProvider client={new QueryClient()}>
          <RecurringTransactionList />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(fr.Recurring.deleted));
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
