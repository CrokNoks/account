import { GetEvolutionUseCase } from './get-evolution.use-case';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { Account } from '../../accounts/domain/account.entity';
import { Period } from '../../periods/domain/period.entity';
import {
  Category,
  CategoryType,
} from '../../categories/domain/category.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';

const category = (id: string, type: CategoryType) =>
  new Category({
    id,
    name: id,
    color: '#000000',
    type,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const tx = (
  date: string,
  amount: number,
  categoryId: string | null,
  reconciled = false,
) =>
  Transaction.create({
    accountId: 'acc-1',
    categoryId,
    date: new Date(date),
    description: 'tx',
    amount: BigInt(amount),
    reconciled,
    pending: false,
  });

describe('GetEvolutionUseCase', () => {
  const march = Period.create({
    id: 'mars',
    accountId: 'acc-1',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-31'),
    isActive: false,
  });
  const april = Period.create({
    id: 'avril',
    accountId: 'acc-1',
    startDate: new Date('2026-04-01'),
    endDate: null,
    isActive: true,
  });

  let accounts: { findById: jest.Mock };
  let periods: { findAllByAccount: jest.Mock };
  let transactions: { findAllByAccountUnpaginated: jest.Mock };
  let categories: { findAllByAccount: jest.Mock };
  let useCase: GetEvolutionUseCase;

  beforeEach(() => {
    accounts = {
      findById: jest.fn().mockResolvedValue(
        new Account({
          id: 'acc-1',
          name: 'Courant',
          ownerId: 'u-1',
          initialBalance: BigInt(100000),
        }),
      ),
    };
    periods = { findAllByAccount: jest.fn().mockResolvedValue([april, march]) };
    transactions = {
      findAllByAccountUnpaginated: jest
        .fn()
        .mockResolvedValue([
          tx('2026-02-15', -10000, 'courses', true),
          tx('2026-03-02', 250000, 'salaire', true),
          tx('2026-03-10', -40000, 'courses', true),
          tx('2026-03-20', -5000, null),
          tx('2026-04-02', 250000, 'salaire'),
          tx('2027-01-01', -1000, 'courses'),
        ]),
    };
    categories = {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([
          category('salaire', CategoryType.INCOME),
          category('courses', CategoryType.EXPENSE),
        ]),
    };
    useCase = new GetEvolutionUseCase(
      accounts as unknown as AccountRepository,
      periods as unknown as PeriodRepository,
      transactions as unknown as TransactionRepository,
      categories as unknown as CategoryRepository,
    );
  });

  it('returns one point per period, in chronological order', async () => {
    const points = await useCase.execute('acc-1');

    expect(points.map((p) => p.periodId)).toEqual(['mars', 'avril']);
    expect(points[0]).toMatchObject({
      startDate: march.startDate.toISOString(),
      endDate: march.endDate!.toISOString(),
      isActive: false,
    });
    expect(points[1]).toMatchObject({ endDate: '', isActive: true });
  });

  it('computes income, expenses and per-category totals of each period', async () => {
    const [mars, avril] = await useCase.execute('acc-1');

    expect(mars).toMatchObject({
      realIncome: '250000',
      realExpenses: '-40000',
      categories: { salaire: '250000', courses: '-40000' },
    });
    // période ouverte : tout ce qui suit le début compte, y compris le futur
    expect(avril).toMatchObject({
      realIncome: '250000',
      realExpenses: '-1000',
    });
  });

  it('computes bank balance (reconciled) and forecast (all transactions) from the start balance', async () => {
    const [mars] = await useCase.execute('acc-1');

    // départ : 100000 - 10000 = 90000
    expect(mars.realBankBalance).toBe(String(90000 + 250000 - 40000));
    expect(mars.forecastBalance).toBe(String(90000 + 250000 - 40000 - 5000));
  });

  it('keeps only closed periods when onlyClosed is true', async () => {
    const points = await useCase.execute('acc-1', true);

    expect(points.map((p) => p.periodId)).toEqual(['mars']);
  });

  it('rejects an unknown account', async () => {
    accounts.findById.mockResolvedValue(null);

    await expect(useCase.execute('acc-1')).rejects.toThrow('Account not found');
  });
});

describe('GetEvolutionUseCase : fenêtre de période (factures réservées)', () => {
  const run = async (
    list: Transaction[],
    periodsList: Period[],
    onlyClosed = false,
  ) =>
    new GetEvolutionUseCase(
      {
        findById: jest.fn().mockResolvedValue(
          new Account({
            id: 'acc-1',
            name: 'Courant',
            ownerId: 'u-1',
            initialBalance: BigInt(100000),
          }),
        ),
      } as unknown as AccountRepository,
      {
        findAllByAccount: jest.fn().mockResolvedValue(periodsList),
      } as unknown as PeriodRepository,
      {
        findAllByAccountUnpaginated: jest.fn().mockResolvedValue(list),
      } as unknown as TransactionRepository,
      {
        findAllByAccount: jest
          .fn()
          .mockResolvedValue([
            category('salaire', CategoryType.INCOME),
            category('courses', CategoryType.EXPENSE),
          ]),
      } as unknown as CategoryRepository,
    ).execute('acc-1', onlyClosed);

  const oct = Period.create({
    id: 'oct',
    accountId: 'acc-1',
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-31'),
    isActive: false,
  });
  const nov = Period.create({
    id: 'nov',
    accountId: 'acc-1',
    startDate: new Date('2026-11-01'),
    endDate: new Date('2026-11-30'),
    isActive: true,
  });

  it('active period: counts what is dated after the end, expense or income (CA2)', async () => {
    const [, novPoint] = await run(
      [
        tx('2026-11-10', -30000, 'courses', true),
        tx('2026-12-05', -12000, 'courses'),
        tx('2026-12-06', 50000, 'salaire'),
      ],
      [nov, oct],
    );

    expect(novPoint).toMatchObject({
      realExpenses: '-42000',
      realIncome: '50000',
      forecastBalance: '108000',
      realBankBalance: '70000',
    });
  });

  it('closed period keeps its end; the start balance of a period does not double count a dated-after expense', async () => {
    const [octPoint, novPoint] = await run(
      [
        tx('2026-10-10', -10000, 'courses', true),
        tx('2026-11-05', -5000, 'courses'),
      ],
      [nov, oct],
    );

    expect(octPoint.realExpenses).toBe('-10000');
    expect(octPoint.forecastBalance).toBe('90000');
    // le départ de novembre = 100000 - 10000 ; -5000 compté une seule fois
    expect(novPoint.forecastBalance).toBe('85000');
  });
});

describe('GetEvolutionUseCase : départs séparés et revenu tardif (CA8)', () => {
  const at = (
    date: string,
    amount: number,
    categoryId: string | null,
    flags: { reconciled?: boolean; pending?: boolean } = {},
  ) =>
    Transaction.create({
      accountId: 'acc-1',
      categoryId,
      date: new Date(date),
      description: 'tx',
      amount: BigInt(amount),
      reconciled: flags.reconciled ?? false,
      pending: flags.pending ?? false,
    });

  const run = async (list: Transaction[], periodsList: Period[]) =>
    new GetEvolutionUseCase(
      {
        findById: jest.fn().mockResolvedValue(
          new Account({
            id: 'acc-1',
            name: 'Courant',
            ownerId: 'u-1',
            initialBalance: BigInt(0),
          }),
        ),
      } as unknown as AccountRepository,
      {
        findAllByAccount: jest.fn().mockResolvedValue(periodsList),
      } as unknown as PeriodRepository,
      {
        findAllByAccountUnpaginated: jest.fn().mockResolvedValue(list),
      } as unknown as TransactionRepository,
      {
        findAllByAccount: jest
          .fn()
          .mockResolvedValue([
            category('salaire', CategoryType.INCOME),
            category('courses', CategoryType.EXPENSE),
          ]),
      } as unknown as CategoryRepository,
    ).execute('acc-1');

  const p1 = Period.create({
    id: 'p1',
    accountId: 'acc-1',
    startDate: new Date('2026-02-01'),
    endDate: new Date('2026-02-28'),
    isActive: false,
  });
  const p2 = Period.create({
    id: 'p2',
    accountId: 'acc-1',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-31'),
    isActive: true,
  });

  // Exemple A (centimes) : avant P2 : salaire +2000 pointé, loyer -800 pointé, CB -60, facture -90 pending.
  const exampleA = () => [
    at('2026-02-01', 200000, 'salaire', { reconciled: true }),
    at('2026-02-02', -80000, 'courses', { reconciled: true }),
    at('2026-02-20', -6000, 'courses'),
    at('2026-02-25', -9000, 'courses', { pending: true }),
    at('2026-03-05', 200000, 'salaire', { reconciled: true }),
    at('2026-03-10', -30000, 'courses', { reconciled: true }),
    at('2026-03-12', -4000, 'courses'),
    at('2026-03-20', -80000, 'courses', { pending: true }),
  ];

  it('E1 : exemple A, realBankBalance de P2 = 2 900 (pointées seules), forecastBalance inchangé', async () => {
    const [, point2] = await run(exampleA(), [p2, p1]);

    expect(point2.realBankBalance).toBe('290000');
    // départ complet 1050 + toute la fenêtre (2000 - 300 - 40 - 800)
    expect(point2.forecastBalance).toBe(
      String(105000 + 200000 - 30000 - 4000 - 80000),
    );
  });

  it('E2 : exemple F, la prime pointée datée après la fin est dans la fenêtre : realBankBalance 3 200 et forecastBalance', async () => {
    const [, point2] = await run(
      [...exampleA(), at('2026-04-02', 30000, 'salaire', { reconciled: true })],
      [p2, p1],
    );

    expect(point2.realBankBalance).toBe('320000');
    expect(point2.forecastBalance).toBe(
      String(105000 + 200000 + 30000 - 30000 - 4000 - 80000),
    );
    expect(point2.realIncome).toBe('230000');
  });

  it('E3 : période fermée, la CB non pointée avant le début n’entre pas dans le départ de la banque', async () => {
    const [point1, point2] = await run(
      [
        at('2026-01-10', 100000, 'salaire', { reconciled: true }),
        at('2026-01-20', -6000, 'courses'),
        at('2026-02-10', 50000, 'salaire', { reconciled: true }),
      ],
      [p2, p1],
    );

    expect(point1.realBankBalance).toBe('150000'); // 1000 + 500, la CB -60 est ignorée
    expect(point1.forecastBalance).toBe('144000'); // départ complet 940 + 500
    expect(point2.realBankBalance).toBe('150000');
  });

  it('un revenu non pointé daté après la fin reste ignoré', async () => {
    const [, point2] = await run(
      [...exampleA(), at('2026-04-02', 30000, 'salaire', { pending: true })],
      [p2, p1],
    );

    expect(point2.realBankBalance).toBe('290000');
  });
});
