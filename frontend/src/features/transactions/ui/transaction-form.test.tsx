import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionForm } from './transaction-form';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
// Like the real ones: a button that receives the id.
vi.mock('@/features/tags/ui/tag-selector', () => ({
  TagSelector: ({ id }: { id?: string }) => <button type="button" id={id} data-testid="tags" />,
}));
vi.mock('@/features/categories/ui/category-selector', () => ({
  CategorySelector: ({ id }: { id?: string }) => <button type="button" id={id} data-testid="category" />,
}));
const accounts = [{ id: 'acc-1', name: 'Courant' }, { id: 'acc-2', name: 'Livret' }];
vi.mock('@/features/accounts/api/use-accounts', () => ({ useAccounts: () => ({ data: accounts }) }));
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

describe('TransactionForm amount field (bureau : signe tapé ; jsdom sans matchMedia = bureau)', () => {
  it('uses a full keyboard (which has a "-" key) and keeps a typed negative amount', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const { screen } = await import('@testing-library/react');
    const { toCents } = await import('@/shared/lib/format');
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TransactionForm accountId="acc-1" onSubmit={onSubmit} isPending={false} submitLabel="ok" />);

    const amount = screen.getByPlaceholderText('amount_placeholder') as HTMLInputElement;
    // type="number", inputMode="decimal"/"numeric" give iOS a keypad without "-"
    expect(amount.type).toBe('text');
    expect(amount.getAttribute('inputmode')).toBe('text');
    expect(amount.getAttribute('pattern')).toBeNull();

    await user.type(screen.getByPlaceholderText('form.description_placeholder_standard'), 'Courses');
    await user.type(amount, '-12,5');
    expect(amount.value).toBe('-12,5');

    await user.click(screen.getByRole('button', { name: /^ok/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(toCents(onSubmit.mock.calls[0][0].amount)).toBe('-1250');
  });
});

describe('TransactionForm labels', () => {
  it('links the visible labels to their fields (standard)', () => {
    render(<TransactionForm accountId="acc-1" onSubmit={vi.fn()} isPending={false} submitLabel="ok" />);

    expect(screen.getByLabelText('fields.date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('fields.description')).toHaveAttribute('placeholder', 'form.description_placeholder_standard');
    expect(screen.getByLabelText('fields.category')).toBe(screen.getByTestId('category'));
    expect(screen.getByLabelText('filters.tags')).toBe(screen.getByTestId('tags'));
    expect(screen.getByLabelText('fields.amount')).toHaveAttribute('placeholder', 'amount_placeholder');
    expect(screen.getByLabelText('fields.pending')).toBeTruthy();
  });

  it('links the destination account label to its select (transfer)', () => {
    render(<TransactionForm accountId="acc-1" mode="transfer" onSubmit={vi.fn()} isPending={false} submitLabel="ok" />);

    expect(screen.getByLabelText('form.destination_account')).toHaveTextContent('form.select_destination');
  });
});

describe('TransactionForm pending field on a reconciled transaction (CA9)', () => {
  it('greys out the upcoming-bill checkbox and never sends pending: true', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TransactionForm
        accountId="acc-1"
        reconciled
        initialValues={{ description: 'Courses', amount: '-12,5', pending: true }}
        onSubmit={onSubmit}
        isPending={false}
        submitLabel="ok"
      />,
    );

    const checkbox = screen.getByLabelText('fields.pending');
    expect((checkbox as HTMLInputElement).disabled).toBe(true);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('form.pending_unavailable_reconciled')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^ok/ }));
    expect(onSubmit.mock.calls[0][0].pending).toBe(false);
  });

  it('leaves the checkbox usable on a transaction that is not reconciled', () => {
    render(
      <TransactionForm accountId="acc-1" onSubmit={vi.fn()} isPending={false} submitLabel="ok" />,
    );

    const checkbox = screen.getByLabelText('fields.pending');
    expect(checkbox.hasAttribute('disabled')).toBe(false);
  });
});
