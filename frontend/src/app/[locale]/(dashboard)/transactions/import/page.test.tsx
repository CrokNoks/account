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
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() },
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

// Back stand-in: transactions already in the account (list answer).
function mockExisting(existing: Array<Record<string, unknown>>) {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { data: existing, meta: { total: existing.length } } });
}

// Back stand-in: one prediction per description, in order.
function mockPredictions(byDescription: Record<string, string> = {}) {
  mockExisting([]);
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

describe('CSV import page header row', () => {
  // Invented export shaped like a Crédit Agricole one: a preamble, then the header on line 5.
  const csv = [
    'Compte courant;',
    'Numéro de compte;00000000000',
    ';',
    'Solde au 31/10/2026;1 234,56',
    'Date;Libellé;Débit euros;Crédit euros',
    '01/10/2026;Magasin Exemple;12,50;',
    '02/10/2026;Salaire Exemple;;1000,00',
  ].join('\n');

  beforeEach(() => {
    bulkCreate.mockReset();
    useAccountStore.setState({ activeAccountId: 'acc-1' });
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockPredictions();
  });

  it('detects the header row, the columns and the debit/credit mode by itself', async () => {
    const lines = await importCsv(csv);

    expect(lines.map((l) => [l.date, l.description, l.amount])).toEqual([
      ['2026-10-01', 'Magasin Exemple', '-1250'],
      ['2026-10-02', 'Salaire Exemple', '100000'],
    ]);
  });

  it('guesses the columns again when the header row is typed by hand', async () => {
    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File([csv], 'releve.csv', { type: 'text/csv' })] },
    });
    const input = (await screen.findByDisplayValue('4')) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByDisplayValue('0')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '4' } });
    fireEvent.click(await screen.findByRole('button', { name: /Analyser les données/ }));
    await screen.findByRole('button', { name: /Confirmer l.import/ });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Analyser/ })).toBeNull());
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByRole('button', { name: /Confirmer l.import/ }));

    const [{ transactions }] = bulkCreate.mock.calls[0] as [{ transactions: ImportedLine[] }];
    expect(transactions.map((l) => l.amount)).toEqual(['-1250', '100000']);
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

describe('CSV import page, Crédit Agricole export', () => {
  // Structure of a real export (anonymised): Windows-1252, preamble, trailing ";",
  // multi-line quoted labels containing ";", debit/credit columns, blank lines at the end.
  const longLabel = [
    'Prélèvement',
    'ORANGE SA-ORANGE - Votre abonnement mobile',
    'EPCB000000000000000                ;FR00ZZZ000000',
    'ABONNEMENT MOBILE ' + 'X'.repeat(200),
    'FR0000000000000000000000000',
  ].join('\n');
  const file = [
    'Téléchargement du 01/01/2026;',
    '',
    '',
    'M.OU MME DUPONT JEAN',
    'Compte de Dépôt carte n° 00000000000;',
    'Solde au 01/01/2026 100,00 €',
    '',
    'Liste des opérations du compte entre le 01/12/2025 et le 01/01/2026',
    '',
    "Date d'opération;Libellé;Débit euros;Crédit euros;",
    `18/12/2025;"${longLabel}";28,99;;`,
    '17/12/2025;"Virement\nSALAIRE EXEMPLE";;34,62;',
    '',
    '',
  ].join('\n');

  beforeEach(() => {
    bulkCreate.mockReset();
    vi.mocked(toast.warning).mockReset();
    useAccountStore.setState({ activeAccountId: 'acc-1' });
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockPredictions();
  });

  async function confirmImport() {
    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File([Uint8Array.from(Buffer.from(file, 'latin1'))], 'CA.csv')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Analyser les données/ }));
    const confirm = await screen.findByRole('button', { name: /Confirmer l.import/ });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Analyser/ })).toBeNull());
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(confirm);
  }

  it('sends single-line, whole descriptions (no cut) and cents', async () => {
    await confirmImport();

    const sent = (bulkCreate.mock.calls[0][0] as { transactions: ImportedLine[] }).transactions;
    expect(sent.map((l) => l.amount)).toEqual(['-2899', '3462']);
    for (const line of sent) expect(line.description).not.toMatch(/\n/);
    expect(sent[0].description.length).toBeGreaterThan(255);
    expect(sent[0].description).toContain('ABONNEMENT MOBILE ' + 'X'.repeat(200));
    const predicted = vi.mocked(apiClient.post).mock.calls.flatMap(
      ([, body]) => (body as { descriptions: string[] }).descriptions,
    );
    expect(predicted).toEqual(sent.map((l) => l.description));
  });

  it('keeps importing but says so when the category prediction fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.post).mockReset().mockRejectedValue(new Error('Request failed with status code 400'));

    await confirmImport();

    expect(bulkCreate).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Category prediction failed', expect.any(Error));
    expect(toast.warning).toHaveBeenCalledWith(fr.Import.prediction_error);
    error.mockRestore();
  });
});

describe('CSV import page period switch message', () => {
  const csv = ['Date;Libellé;Montant', '28/11/2026;PAIE;2000,00'].join('\n');
  const periodSwitch = {
    closed: { id: 'p1', startDate: '2026-10-01', endDate: '2026-11-27' },
    opened: { id: 'p2', startDate: '2026-11-28', endDate: '2026-12-27' },
    count: 1,
    dateChanged: false,
  };

  beforeEach(() => {
    bulkCreate.mockReset();
    vi.mocked(toast.success).mockReset();
    useAccountStore.setState({ activeAccountId: 'acc-1' });
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockPredictions();
  });

  it('tells which period was closed and which one opened when the import switched', async () => {
    bulkCreate.mockImplementation((_vars, options) => options.onSuccess([{ id: 't1', periodSwitch }]));
    const confirm = await openValidation(csv);
    fireEvent.click(confirm);

    expect(toast.success).toHaveBeenCalledWith(
      'Période du 01/10/2026 au 27/11/2026 clôturée ; nouvelle période du 28/11/2026 au 27/12/2026.',
      undefined,
    );
  });

  it('says nothing about periods when the import did not switch', async () => {
    bulkCreate.mockImplementation((_vars, options) => options.onSuccess([{ id: 't1' }]));
    const confirm = await openValidation(csv);
    fireEvent.click(confirm);

    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});

describe('CSV import page : lignes déjà présentes', () => {
  const csv = [
    'Date;Libellé;Montant',
    '25/11/2026;CB CAFE;-2,50',
    '25/11/2026;CB CAFE;-2,50',
    '26/11/2026;CB BOULANGERIE PAUL;-8,50',
    '27/11/2026;NOUVEAU;-1',
    'nope;ILLISIBLE;-3',
  ].join('\n');
  const existing = [
    { id: 't1', date: '2026-11-25T00:00:00.000Z', description: 'cb café', amount: '-250', pending: false },
    { id: 't2', date: '2026-11-25', description: 'Boulangerie', amount: '-850', pending: false },
    { id: 't3', date: '2026-11-27', description: 'NOUVEAU', amount: '-100', pending: true },
  ];

  beforeEach(() => {
    bulkCreate.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.warning).mockReset();
    useAccountStore.setState({ activeAccountId: 'acc-1' });
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockPredictions();
    mockExisting(existing);
  });

  const boxes = () => screen.getAllByRole('checkbox');

  it('lit les transactions du compte importé sur la fenêtre du fichier (+/- 3 jours)', async () => {
    await openValidation(csv);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/acc-1/transactions', {
      params: { startDate: '2026-11-22', endDate: '2026-11-30', limit: 5000 },
    });
  });

  it('décoche la ligne identique (un seul café en base), signale la proche, et n envoie que les cochées', async () => {
    const confirm = await openValidation(csv);

    expect(boxes().map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true', 'true', 'true', 'false']);
    expect(screen.getByText(/Déjà présente · 25\/11\/2026 · cb café/)).toBeInTheDocument();
    expect(screen.getByText(/Ligne proche · 25\/11\/2026 · Boulangerie/)).toBeInTheDocument();

    fireEvent.click(confirm);
    const [{ transactions, importStats }] = bulkCreate.mock.calls[0] as [
      { transactions: ImportedLine[]; importStats: unknown },
    ];
    expect(transactions.map((l) => l.description)).toEqual(['CB CAFE', 'CB BOULANGERIE PAUL', 'NOUVEAU']);
    expect(importStats).toEqual({ excluded: 1, rechecked: 0, closeFlagged: 1 });

    bulkCreate.mock.calls[0][1].onSuccess();
    expect(toast.success).toHaveBeenCalledWith('3 transactions importées, 1 ligne ignorée, 1 ligne écartée (déjà présente)');
  });

  it('recocher une ligne décochée l envoie et la compte comme recochée', async () => {
    const confirm = await openValidation(csv);
    fireEvent.click(boxes()[0]);
    await waitFor(() => expect(boxes()[0].getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(confirm);
    const [{ transactions, importStats }] = bulkCreate.mock.calls[0] as [
      { transactions: ImportedLine[]; importStats: unknown },
    ];
    expect(transactions).toHaveLength(4);
    expect(importStats).toEqual({ excluded: 1, rechecked: 1, closeFlagged: 1 });
  });

  it('désactive la confirmation quand plus aucune ligne n est cochée', async () => {
    mockExisting([{ id: 't1', date: '2026-03-01', description: 'a', amount: '-100', pending: false }]);
    const confirm = await openValidation(['Date;Libellé;Montant', '01/03/2026;A;-1'].join('\n'));
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(bulkCreate).not.toHaveBeenCalled();
  });

  it('ne compare jamais une ligne illisible', async () => {
    mockExisting([{ id: 't1', date: '2026-03-01', description: 'A', amount: '0', pending: false }]);
    await openValidation(['Date;Libellé;Montant', '01/03/2026;A;x'].join('\n'));
    expect(screen.queryByText(/Déjà présente/)).toBeNull();
    expect(screen.queryByText(/Ligne proche/)).toBeNull();
  });

  it('CA8 : lecture impossible, import possible, rien de décoché, avertissement, pas de comptage', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.get).mockRejectedValue(new Error('boom'));
    const confirm = await openValidation(csv);
    expect(toast.warning).toHaveBeenCalledWith(fr.Import.existing_error);
    expect(boxes().filter((b) => b.getAttribute('aria-checked') === 'true')).toHaveLength(4);
    fireEvent.click(confirm);
    const [call] = bulkCreate.mock.calls[0] as [{ transactions: ImportedLine[]; importStats?: unknown }];
    expect(call.transactions).toHaveLength(4);
    expect(call.importStats).toBeUndefined();
    error.mockRestore();
  });

  it('lecture tronquée (plus de transactions que reçues) : traitée comme un échec', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: existing, meta: { total: 6000 } } });
    await openValidation(csv);
    expect(toast.warning).toHaveBeenCalledWith(fr.Import.existing_error);
    expect(boxes().filter((b) => b.getAttribute('aria-checked') === 'true')).toHaveLength(4);
    error.mockRestore();
  });

  it('CA7 : une paie écartée n est pas envoyée (donc ni bascule ni nettoyage)', async () => {
    mockExisting([{ id: 't1', date: '2026-11-28', description: 'PAIE', amount: '200000', pending: false }]);
    const confirm = await openValidation(['Date;Libellé;Montant', '28/11/2026;PAIE;2000,00', '29/11/2026;X;-1'].join('\n'));
    fireEvent.click(confirm);
    const [{ transactions }] = bulkCreate.mock.calls[0] as [{ transactions: ImportedLine[] }];
    expect(transactions.map((l) => l.description)).toEqual(['X']);
  });

  it('change de compte à l écran : le résultat de l ancien compte est rejeté (retour à l étape 1)', async () => {
    let release: (v: unknown) => void = () => {};
    vi.mocked(apiClient.get).mockReturnValue(new Promise((r) => (release = r)) as never);
    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File([csv], 'releve.csv')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Analyser les données/ }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    useAccountStore.setState({ activeAccountId: 'acc-2' });
    release({ data: { data: existing, meta: { total: existing.length } } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Confirmer l.import/ })).toBeNull());
    expect(screen.getByText(fr.Import.subtitle_upload)).toBeInTheDocument();
  });

  it('toast : une ligne décochée à la main est « non sélectionnée », pas « écartée »', async () => {
    const confirm = await openValidation(csv);
    fireEvent.click(boxes()[3]); // boulangerie (proche, pas un doublon exact)
    await waitFor(() => expect(boxes()[3].getAttribute('aria-checked')).toBe('false'));
    fireEvent.click(confirm);
    bulkCreate.mock.calls[0][1].onSuccess();
    expect(toast.success).toHaveBeenCalledWith(
      '2 transactions importées, 1 ligne ignorée, 1 ligne écartée (déjà présente), 1 ligne non sélectionnée',
    );
  });

  it('toast : lecture en échec, une ligne décochée à la main est comptée non sélectionnée', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.get).mockRejectedValue(new Error('boom'));
    const confirm = await openValidation(['Date;Libellé;Montant', '01/03/2026;A;-1', '02/03/2026;B;-2'].join('\n'));
    fireEvent.click(boxes()[0]);
    await waitFor(() => expect(boxes()[0].getAttribute('aria-checked')).toBe('false'));
    fireEvent.click(confirm);
    bulkCreate.mock.calls[0][1].onSuccess();
    expect(toast.success).toHaveBeenCalledWith('1 transaction importée, 1 ligne non sélectionnée');
    error.mockRestore();
  });

  it('toast en anglais : not selected', async () => {
    const { container } = renderPage('en');
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['Date;Label;Amount\n01/03/2026;A;-1\n02/03/2026;B;-2'], 'a.csv')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Analyze/ }));
    const confirm = await screen.findByRole('button', { name: /Confirm/ });
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(boxes()[0]);
    await waitFor(() => expect(boxes()[0].getAttribute('aria-checked')).toBe('false'));
    fireEvent.click(confirm);
    bulkCreate.mock.calls[0][1].onSuccess();
    expect(toast.success).toHaveBeenCalledWith('1 transaction imported, 1 line not selected');
  });

  it('prédiction : une réponse tardive d\'un compte ou d\'une session remplacée est ignorée', async () => {
    let releaseOld: (v: unknown) => void = () => {};
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.post).mockImplementationOnce(
      () => new Promise((r) => (releaseOld = r)) as never,
    );
    vi.mocked(apiClient.post).mockImplementation((_url, body) =>
      Promise.resolve({
        data: { predictions: (body as { descriptions: string[] }).descriptions.map(() => ({ categoryId: null })) },
      }),
    );
    const { container } = renderPage();
    const load = (content: string) =>
      fireEvent.change(container.querySelector('input[type="file"]')!, {
        target: { files: [new File([content], 'releve.csv')] },
      });
    load('Date;Libellé;Montant\n01/03/2026;ANCIEN;-1');
    fireEvent.click(await screen.findByRole('button', { name: /Analyser les données/ }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1)); // prédiction en attente

    useAccountStore.setState({ activeAccountId: 'acc-2' }); // retour à l'étape 1
    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull());
    load('Date;Libellé;Montant\n01/03/2026;NOUVEAU;-2');
    fireEvent.click(await screen.findByRole('button', { name: /Analyser les données/ }));
    const confirm = await screen.findByRole('button', { name: /Confirmer l.import/ });
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));

    // La réponse de l'ancienne session arrive : même id de ligne (row-0), mais elle ne doit rien changer.
    releaseOld({ data: { predictions: [{ categoryId: 'cat-ancien' }] } });
    await new Promise((r) => setTimeout(r, 10));
    fireEvent.click(confirm);
    const [{ accountId, transactions }] = bulkCreate.mock.calls[0] as [
      { accountId: string; transactions: ImportedLine[] },
    ];
    expect(accountId).toBe('acc-2');
    expect(transactions.map((l) => [l.description, l.categoryId])).toEqual([['NOUVEAU', null]]);
  });

  it('en anglais : toast et bandeaux traduits', async () => {
    const { container } = renderPage('en');
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File([csv], 'releve.csv')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Analyze/ }));
    await screen.findByRole('button', { name: /Confirm/ });
    expect(await screen.findByText(/Already present · 11\/25\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Close line/)).toBeInTheDocument();
    expect(screen.getByText(/1 line set aside/)).toBeInTheDocument();
  });
});
