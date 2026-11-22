import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { PeriodList } from './period-list';

// Stable reference, like react-query.
const periods = [{ id: 'p1', startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', isActive: true }];
vi.mock('@/features/budgets/api/use-periods', () => ({
  usePeriods: () => ({ data: periods, isLoading: false }),
}));
vi.mock('../api/use-update-period', () => ({
  useUpdatePeriod: () => ({ mutate: vi.fn(), isPending: false }),
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
});
