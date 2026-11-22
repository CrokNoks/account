import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../../messages/fr.json';
import { BreakdownTab } from './breakdown-tab';

// Stable reference, like react-query.
const periods = [
  { id: 'p1', startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-10-31T00:00:00.000Z', isActive: false },
  { id: 'p2', startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-30T00:00:00.000Z', isActive: false },
];
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({ usePeriods: () => ({ data: periods }) }));
vi.mock('../../api/use-period-comparison', () => ({
  usePeriodComparison: () => ({ data: undefined, isLoading: true, isError: false }),
}));
vi.mock('@/shared/lib/use-format-currency', () => ({ useFormatCurrency: () => (v: unknown) => String(v) }));

describe('BreakdownTab labels', () => {
  it('links the period labels to their selects', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <BreakdownTab />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText(fr.Reporting.analyses.breakdown.period)).toBeTruthy();
    expect(screen.getByLabelText(fr.Reporting.analyses.breakdown.compare_with)).toBeTruthy();
  });
});
