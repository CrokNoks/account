import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionForm } from './transaction-form';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/features/tags/ui/tag-selector', () => ({ TagSelector: () => null }));
vi.mock('@/features/categories/ui/category-selector', () => ({ CategorySelector: () => null }));
vi.mock('@/features/accounts/api/use-accounts', () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock('@/features/savings/api/use-savings-goals', () => ({ useSavingsGoals: () => ({ data: [] }) }));
vi.mock('../api/use-predict-category', () => ({ usePredictCategory: () => ({ mutate: vi.fn() }) }));

describe('TransactionForm default date', () => {
  afterEach(() => vi.useRealTimers());

  it('defaults to the local calendar day, not the UTC one', () => {
    // 1st November 00:30 local time on the machine (UTC+1: still 31 October in UTC)
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 1, 0, 30));

    const { container } = render(
      <TransactionForm accountId="acc-1" onSubmit={vi.fn()} isPending={false} submitLabel="ok" />,
    );

    expect((container.querySelector('input[type="date"]') as HTMLInputElement).value).toBe('2026-11-01');
  });
});
