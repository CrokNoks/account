import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/api-client';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import ImportPage from './page';

const bulkCreate = vi.fn();

vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/shared/api/api-client', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/features/categories/api/use-categories', () => ({
  useCategories: () => ({ data: [] }),
}));
vi.mock('@/features/budgets/api/use-periods', () => ({
  usePeriods: () => ({
    data: [
      { id: 'per-old', isActive: false },
      { id: 'per-1', isActive: true },
    ],
  }),
}));
vi.mock('@/features/transactions/api/use-bulk-create-transactions', () => ({
  useBulkCreateTransactions: () => ({ mutate: bulkCreate, isPending: false }),
}));

type ImportedLine = {
  date: string;
  description: string;
  amount: string;
  categoryId: string | null;
  periodId: string | null;
  reconciled: boolean;
};

async function importCsv(csv: string, separate = false): Promise<ImportedLine[]> {
  const { container } = render(<ImportPage />);
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, {
    target: { files: [new File([csv], 'releve.csv', { type: 'text/csv' })] },
  });

  if (separate) fireEvent.click(await screen.findByRole('button', { name: /Débit \/ Crédit/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Analyser les données/ }));
  const confirm = await screen.findByRole('button', { name: /Confirmer l.import/ });
  await waitFor(() => expect(confirm).toBeEnabled());
  // Attendre la fin des prédictions de catégorie (une par ligne).
  await waitFor(() => expect(screen.queryByRole('button', { name: /Analyser/ })).toBeNull());
  await new Promise((r) => setTimeout(r, 0));
  fireEvent.click(confirm);

  expect(bulkCreate).toHaveBeenCalledTimes(1);
  const [{ accountId, transactions }] = bulkCreate.mock.calls[0] as [
    { accountId: string; transactions: ImportedLine[] },
  ];
  expect(accountId).toBe('acc-1');
  return transactions;
}

describe('CSV import page', () => {
  beforeEach(() => {
    bulkCreate.mockReset();
    useAccountStore.setState({ activeAccountId: 'acc-1' });
    vi.mocked(apiClient.get).mockReset().mockResolvedValue({ data: {} });
  });

  it('maps a French bank export (semicolon, dd/mm/yyyy, comma decimals) to cents', async () => {
    const lines = await importCsv(
      [
        'Date;Libellé;Montant',
        '01/03/2026;CB CARREFOUR;-42,50',
        '2/3/26;SALAIRE;2500,00',
        '2026-03-06;VIREMENT ISO;10',
      ].join('\n'),
    );

    expect(lines).toEqual([
      {
        date: '2026-03-01',
        description: 'CB CARREFOUR',
        amount: '-4250',
        categoryId: null,
        periodId: 'per-1',
        reconciled: true,
      },
      expect.objectContaining({ date: '2026-03-02', amount: '250000' }),
      expect.objectContaining({ date: '2026-03-06', amount: '1000' }),
    ]);
  });

  it('skips rows without date or description', async () => {
    const lines = await importCsv(
      ['Date;Libellé;Montant', ';SANS DATE;-1', '01/03/2026;;-2', '01/03/2026;OK;-3'].join(
        '\n',
      ),
    );

    expect(lines.map((l) => l.description)).toEqual(['OK']);
  });

  it('applies the predicted category of each description', async () => {
    vi.mocked(apiClient.get).mockImplementation((_url, config) =>
      Promise.resolve({
        data:
          (config?.params as { description: string }).description === 'CB CARREFOUR'
            ? { categoryId: 'cat-courses' }
            : {},
      }),
    );

    const lines = await importCsv(
      ['Date;Libellé;Montant', '01/03/2026;CB CARREFOUR;-42,50', '01/03/2026;AUTRE;-1'].join(
        '\n',
      ),
    );

    expect(apiClient.get).toHaveBeenCalledWith('/acc-1/transactions/predict-category', {
      params: { description: 'CB CARREFOUR' },
    });
    expect(lines.map((l) => l.categoryId)).toEqual(['cat-courses', null]);
  });

  it('removes spaces used as thousands separators', async () => {
    const [line] = await importCsv(['Date;Libellé;Montant', '01/03/2026;LOYER;"-1 234,56"'].join('\n'));

    expect(line.amount).toBe('-123456');
  });

  it('turns "-1.234,56" into -123456 cents (dot as thousands separator)', async () => {
    const [line] = await importCsv(['Date;Libellé;Montant', '01/03/2026;LOYER;-1.234,56'].join('\n'));

    expect(line.amount).toBe('-123456');
  });

  it('keeps "12,345.67" as 1234567 cents and a trailing minus as negative', async () => {
    const lines = await importCsv(
      ['Date;Libellé;Montant', '01/03/2026;A;"12,345.67"', '01/03/2026;B;42,50-'].join('\n'),
    );

    expect(lines.map((l) => l.amount)).toEqual(['1234567', '-4250']);
  });

  it('keeps reading amounts exported with a currency symbol or code', async () => {
    const lines = await importCsv(
      [
        'Date;Libellé;Montant',
        '01/03/2026;A;"-42,50 EUR"',
        '01/03/2026;B;"1 234,56 €"',
        '01/03/2026;C;USD 10.00',
        '01/03/2026;D;12abc',
      ].join('\n'),
    );

    // an unreadable cell ("12abc") stays imported as 0 (existing behaviour), never as 1200
    expect(lines.map((l) => l.amount)).toEqual(['-4250', '123456', '1000', '0']);
  });

  it('computes debit/credit columns in integer cents (no float drift)', async () => {
    const lines = await importCsv(
      [
        'Date;Libellé;Debit;Credit',
        '01/03/2026;A;"1.234,56";',
        '02/03/2026;B;;"2 000,10"',
        '03/03/2026;C;0,10;0,30',
        '04/03/2026;D;-5,05;',
      ].join('\n'),
      true,
    );

    expect(lines.map((l) => l.amount)).toEqual(['-123456', '200010', '20', '-505']);
  });
});
