import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import { PeriodList } from './period-list';

// Stable reference, like react-query.
const periods = [{ id: 'p1', startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', isActive: true }];
const withNewer = [
  { id: 'p2', startDate: '2027-01-01T00:00:00.000Z', endDate: '2027-01-31T00:00:00.000Z', isActive: false },
  { id: 'p1', startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', isActive: false },
];
const state = { list: periods };
const apiError = vi.hoisted(() => ({ code: undefined as string | undefined }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/budgets/api/use-periods', () => ({
  usePeriods: () => ({ data: state.list, isLoading: false }),
}));
vi.mock('../api/use-update-period', () => ({
  useUpdatePeriod: () => ({
    mutate: (_cmd: unknown, opts?: { onError?: (e: unknown) => void }) => {
      if (apiError.code) opts?.onError?.({ isAxiosError: true, response: { data: { code: apiError.code } } });
    },
    isPending: false,
  }),
}));
vi.mock('../api/use-delete-period', () => ({
  useDeletePeriod: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));

describe('PeriodList', () => {
  it('links the date labels of the edit drawer to their fields', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <PeriodList />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByTitle(fr.Budgets.edit_dates));

    expect(screen.getByLabelText(fr.Budgets.fields.start_date)).toHaveValue('2026-12-01');
    expect(screen.getByLabelText(fr.Budgets.fields.end_date)).toHaveValue('2026-12-31');
  });

  it('disables the active checkbox of a period that is not the latest, enables it for the latest', () => {
    state.list = withNewer;
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <PeriodList />
      </NextIntlClientProvider>,
    );
    const [editLatest, editOld] = screen.getAllByTitle(fr.Budgets.edit_dates);
    fireEvent.click(editOld);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(fr.Budgets.reactivate_only_latest)).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(editLatest);
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-disabled', 'true');
    state.list = periods;
  });

  it('shows the API refusal in the edit drawer when the new start date is before another period', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <PeriodList />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByTitle(fr.Budgets.edit_dates));
    apiError.code = 'PERIOD_BEFORE_EXISTING';
    fireEvent.click(screen.getByRole('button', { name: fr.Common.save }));
    apiError.code = undefined;

    expect(toast.error).toHaveBeenCalledWith(fr.Budgets.period_before_existing);
  });
});
