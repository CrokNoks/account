import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import { CreatePeriodDialog } from './create-period-dialog';

const create = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Stable reference, like react-query.
const draft = {
  suggestedStartDate: '2026-12-01T00:00:00.000Z',
  suggestedEndDate: '2026-12-31T00:00:00.000Z',
  categoriesWithStats: [
    { categoryId: 'c1', name: 'Loyer', type: 'EXPENSE', defaultAllocated: '-320050', minReal: '0', maxReal: '0', avgReal: '0' },
    { categoryId: 'c2', name: 'Cadeaux', type: 'EXPENSE', defaultAllocated: '9007199254740993', minReal: '0', maxReal: '0', avgReal: '0' },
  ],
};
vi.mock('../api/use-period-draft', () => ({
  usePeriodDraft: () => ({ data: draft, isLoading: false, refetch: vi.fn() }),
}));
vi.mock('../api/use-create-period', () => ({
  useCreatePeriod: () => ({ mutate: create, isPending: false }),
}));
vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));

describe('CreatePeriodDialog', () => {
  it('pre-fills the default budgets with the exact absolute amount in French format', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <CreatePeriodDialog />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);

    const values = screen.getAllByRole('textbox').map((i) => (i as HTMLInputElement).value);
    expect(values).toContain('3200,50');
    expect(values).toContain('90071992547409,93');
  });

  const open = () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <CreatePeriodDialog />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    return screen.getAllByRole('textbox').filter((i) => (i as HTMLInputElement).value.includes(',')) as HTMLInputElement[];
  };

  it('sends an untouched negative default as is, a modified one as positive', () => {
    create.mockClear();
    const [rent] = open();
    fireEvent.click(screen.getByRole('button', { name: fr.Common.add }));
    expect(create.mock.calls[0][0].budgets[0]).toEqual({ categoryId: 'c1', amountAllocated: '-320050' });

    fireEvent.change(rent, { target: { value: '3300,00' } });
    fireEvent.click(screen.getByRole('button', { name: fr.Common.add }));
    expect(create.mock.calls[1][0].budgets[0]).toEqual({ categoryId: 'c1', amountAllocated: '330000' });
  });

  it('refuses a newly typed negative amount', () => {
    create.mockClear();
    const [rent] = open();
    fireEvent.change(rent, { target: { value: '-10' } });
    fireEvent.click(screen.getByRole('button', { name: fr.Common.add }));

    expect(create).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(fr.BudgetsScreen.negative_amount);
  });

  it('links the date labels to their fields', () => {
    open();
    expect(screen.getByLabelText(fr.Budgets.fields.start_date)).toHaveValue('2026-12-01');
    expect(screen.getByLabelText(fr.Budgets.fields.end_date)).toHaveValue('2026-12-31');
  });
});
