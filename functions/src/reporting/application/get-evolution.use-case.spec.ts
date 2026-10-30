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
