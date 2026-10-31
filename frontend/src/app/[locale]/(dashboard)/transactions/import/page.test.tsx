import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { toast } from 'sonner';
import fr from '../../../../../../messages/fr.json';
import en from '../../../../../../messages/en.json';
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
vi.mock('@/shared/api/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
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

const catalogs = { fr, en };

// Back stand-in: one prediction per description, in order.
function mockPredictions(byDescription: Record<string, string> = {}) {
  vi.mocked(apiClient.post).mockImplementation((_url, body) =>
    Promise.resolve({
      data: {
        predictions: (body as { descriptions: string[] }).descriptions.map((d) => ({
          categoryId: byDescription[d] ?? null,
        })),
      },
    }),
  );
}

function renderPage(locale: 'fr' | 'en' = 'fr') {
  return render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]}>
      <ImportPage />
    </NextIntlClientProvider>,
  );
}

async function openValidation(csv: string, separate = false) {
  const { container } = renderPage();
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, {
    target: { files: [new File([csv], 'releve.csv', { type: 'text/csv' })] },
  });

  if (separate) fireEvent.click(await screen.findByRole('button', { name: /Débit \/ Crédit/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Analyser les données/ }));
  const confirm = await screen.findByRole('button', { name: /Confirmer l.import/ });
  // Attendre la fin des prédictions de catégorie (une par ligne).
  await waitFor(() => expect(screen.queryByRole('button', { name: /Analyser/ })).toBeNull());
  await new Promise((r) => setTimeout(r, 0));
  return confirm;
}

async function importCsv(csv: string, separate = false): Promise<ImportedLine[]> {
  const confirm = await openValidation(csv, separate);
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
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockPredictions();
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
    mockPredictions({ 'CB CARREFOUR': 'cat-courses' });

    const lines = await importCsv(
      ['Date;Libellé;Montant', '01/03/2026;CB CARREFOUR;-42,50', '01/03/2026;AUTRE;-1'].join(
        '\n',
      ),
    );

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/acc-1/transactions/predict-categories', {
      descriptions: ['CB CARREFOUR', 'AUTRE'],
    });
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(lines.map((l) => l.categoryId)).toEqual(['cat-courses', null]);
  });

  it('splits a long file into requests of at most 500 descriptions', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => `01/03/2026;LIGNE ${i};-1`);
    await importCsv(['Date;Libellé;Montant', ...rows].join('\n'));

    const sizes = vi
      .mocked(apiClient.post)
      .mock.calls.map(([, body]) => (body as { descriptions: string[] }).descriptions.length);
    expect(sizes).toEqual([500, 500, 1]);
  }, 30000);

  it('keeps the import usable when the prediction request fails', async () => {
    vi.mocked(apiClient.post).mockReset().mockRejectedValue(new Error('boom'));

    const lines = await importCsv(['Date;Libellé;Montant', '01/03/2026;A;-1'].join('\n'));

    expect(lines.map((l) => l.categoryId)).toEqual([null]);
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
      ].join('\n'),
    );

    expect(lines.map((l) => l.amount)).toEqual(['-4250', '123456', '1000']);
  });

  it.each([['12abc'], ['abc'], ['']])('does not import a row whose amount is unreadable (%j)', async (cell) => {
    const lines = await importCsv(
      ['Date;Libellé;Montant', `01/03/2026;BAD;${cell}`, '01/03/2026;GOOD;-3'].join('\n'),
    );

    expect(lines.map((l) => l.description)).toEqual(['GOOD']);
    expect(screen.getByText('montant illisible')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('1 ligne ignorée');
  });

  it.each([['pas une date'], ['31/02/2026'], ['13/13/2026'], ['2026-02-30']])(
    'does not import a row whose date is unreadable (%j)',
    async (cell) => {
      const lines = await importCsv(
        ['Date;Libellé;Montant', `${cell};BAD;-1`, '01/03/2026;GOOD;-3'].join('\n'),
      );

      expect(lines.map((l) => l.description)).toEqual(['GOOD']);
      expect(screen.getByText('date illisible')).toBeInTheDocument();
    },
  );

  it('sends only the valid rows of a mixed file and counts the ignored ones', async () => {
    const lines = await importCsv(
      [
        'Date;Libellé;Montant',
        '01/03/2026;OK1;-1',
        '01/03/2026;BAD AMOUNT;x',
        'nope;BAD DATE;-2',
        '2026-03-06;OK2;5',
      ].join('\n'),
    );

    expect(lines.map((l) => l.description)).toEqual(['OK1', 'OK2']);
    expect(screen.getByRole('alert')).toHaveTextContent('2 lignes ignorées');
    // one request, without the invalid rows
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/acc-1/transactions/predict-categories', {
      descriptions: ['OK1', 'OK2'],
    });
  });

  it('disables the confirm button when every row is invalid', async () => {
    const confirm = await openValidation(
      ['Date;Libellé;Montant', '01/03/2026;A;x', 'nope;B;-2'].join('\n'),
    );

    expect(confirm).toBeDisabled();
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(confirm);
    expect(bulkCreate).not.toHaveBeenCalled();
  });

  it('treats an unreadable debit/credit cell or two empty cells as an unreadable amount', async () => {
    const lines = await importCsv(
      [
        'Date;Libellé;Debit;Credit',
        '01/03/2026;OK;5,00;',
        '01/03/2026;BAD1;abc;',
        '01/03/2026;BAD2;;',
      ].join('\n'),
      true,
    );

    expect(lines.map((l) => l.description)).toEqual(['OK']);
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

  it('detects accented Débit and Crédit columns automatically', async () => {
    const lines = await importCsv(
      ['Date;Libellé;Débit;Crédit', '01/03/2026;A;12,50;', '02/03/2026;B;;3,00'].join('\n'),
      true,
    );

    expect(lines.map((l) => l.amount)).toEqual(['-1250', '300']);
  });
});

describe('CSV import page encoding', () => {
  const csv = [
    'Date;Libellé;Montant;Débit;Crédit',
    '01/03/2026;Prélèvement Électricité Exemple;-12,00;;',
  ].join('\n');

  async function upload(bytes: Uint8Array<ArrayBuffer>) {
    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File([bytes], 'releve.csv', { type: 'text/csv' })] },
    });
    await screen.findByRole('button', { name: /Analyser les données/ });
  }

  beforeEach(() => {
    bulkCreate.mockReset();
    useAccountStore.setState({ activeAccountId: 'acc-1' });
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockPredictions();
  });

  it('reads a Windows-1252 file with its accents', async () => {
    await upload(Uint8Array.from(Buffer.from(csv, 'latin1')));

    expect(screen.getAllByText('Libellé').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Débit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Crédit').length).toBeGreaterThan(0);
    expect(screen.queryByText(/�/)).toBeNull();
  });

  it('keeps reading the description of a Windows-1252 file', async () => {
    const lines = await importBytes(Uint8Array.from(Buffer.from(csv, 'latin1')));

    expect(lines.map((l) => l.description)).toEqual(['Prélèvement Électricité Exemple']);
  });

  it.each([
    ['without BOM', Buffer.from(csv, 'utf-8')],
    ['with BOM', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, 'utf-8')])],
  ])('keeps a UTF-8 file correct (%s)', async (_label, buf) => {
    await upload(Uint8Array.from(buf));

    expect(screen.getAllByText('Date').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Libellé').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Débit').length).toBeGreaterThan(0);

    const lines = await importBytes(Uint8Array.from(buf));
    expect(lines.map((l) => l.description)).toEqual(['Prélèvement Électricité Exemple']);
  });

  async function importBytes(bytes: Uint8Array<ArrayBuffer>): Promise<ImportedLine[]> {
    document.body.innerHTML = '';
    bulkCreate.mockReset();
    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File([bytes], 'releve.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Analyser les données/ }));
    const confirm = await screen.findByRole('button', { name: /Confirmer l.import/ });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Analyser/ })).toBeNull());
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(confirm);
    return (bulkCreate.mock.calls[0][0] as { transactions: ImportedLine[] }).transactions;
  }
});

describe('CSV import page i18n', () => {
  beforeEach(() => {
    bulkCreate.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.info).mockReset();
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockPredictions();
    useAccountStore.setState({ activeAccountId: 'acc-1' });
  });

  it('shows the English texts, reasons and banner with the en catalog', async () => {
    const { container } = renderPage('en');
    expect(screen.getByText('Upload your bank statement (CSV)')).toBeInTheDocument();
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(['Date;Label;Amount\nnope;A;-1\n01/03/2026;B;x\n01/03/2026;C;-3'], 'a.csv')],
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Analyze data' }));
    await screen.findByRole('button', { name: 'Confirm import' });
    expect(screen.getByText('unreadable date')).toBeInTheDocument();
    expect(screen.getByText('unreadable amount')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('2 lines skipped');
    expect(toast.info).toHaveBeenCalledWith('Analyzing categories...');
  });

  it.each([
    ['fr', 'fr', '1 transaction importée, 1 ligne ignorée'],
    ['en', 'en', '1 transaction imported, 1 line skipped'],
  ] as const)('translates the success toast (%s)', async (locale, _l, expected) => {
    const { container } = renderPage(locale);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['Date;Libellé;Montant\n01/03/2026;OK;-1\nnope;BAD;-2'], 'a.csv')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: locale === 'fr' ? /Analyser/ : /Analyze/ }));
    const confirm = await screen.findByRole('button', { name: locale === 'fr' ? /Confirmer/ : /Confirm/ });
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(confirm);
    bulkCreate.mock.calls[0][1].onSuccess();
    expect(toast.success).toHaveBeenCalledWith(expected);
  });
});
