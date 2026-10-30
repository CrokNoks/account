import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import { SavingsGoalsList } from './savings-goals-list';

const updateGoal = vi.fn();
const goal = {
  id: 'g1', name: 'Vacances', targetAmount: '100000', currentAmount: '5000',
  color: '#3b82f6', deadline: null,
};

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'acc-1' }),
}));
vi.mock('../api/use-savings-goals', () => ({
  useSavingsGoals: () => ({ data: [goal], isLoading: false }),
  useDeleteSavingsGoal: () => ({ mutate: vi.fn() }),
  useUpdateSavingsGoal: () => ({ mutate: updateGoal, isPending: false }),
}));

function contribute(value: string) {
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <SavingsGoalsList />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Épargner/ }));
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: /Enregistrer la contribution/ }));
}

describe('SavingsGoalsList contribution', () => {
  beforeEach(() => {
    updateGoal.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('refuses an unreadable amount instead of contributing 0', () => {
    contribute('abc');
    expect(updateGoal).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(fr.Common.invalid_amount);
  });

  it('adds a readable amount to the current amount', () => {
    contribute('10,50');
    expect(updateGoal).toHaveBeenCalledTimes(1);
    expect(updateGoal.mock.calls[0][0].data.currentAmount).toBe('6050');
  });
});
