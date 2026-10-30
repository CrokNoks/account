import { GetTagDetailsUseCase } from './get-tag-details.use-case';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { TagRepository } from '../../tags/domain/tag.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { Tag } from '../../tags/domain/tag.entity';
import { Period } from '../../periods/domain/period.entity';
import {
  Category,
  CategoryType,
} from '../../categories/domain/category.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';

const tx = (
  id: string,
  date: string,
  amount: number,
  categoryId: string | null,
  tagIds = ['vacances'],
) =>
  Transaction.create({
    id,
    accountId: 'acc-1',
    categoryId,
    date: new Date(date),
    description: `tx ${id}`,
    amount: BigInt(amount),
    reconciled: false,
    pending: false,
    tagIds,
  });

describe('GetTagDetailsUseCase', () => {
  const period = Period.create({
    id: 'per-1',
    accountId: 'acc-1',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-31'),
  });

  let transactions: { findAllByAccountUnpaginated: jest.Mock };
  let tags: { findById: jest.Mock };
  let periods: { findById: jest.Mock };
  let categories: { findAllByAccount: jest.Mock };
  let useCase: GetTagDetailsUseCase;

  beforeEach(() => {
    tags = {
      findById: jest.fn().mockResolvedValue(
        Tag.create({
          id: 'vacances',
          accountId: 'acc-1',
          name: 'Vacances',
          color: '#111111',
        }),
      ),
    };
    transactions = {
      findAllByAccountUnpaginated: jest
        .fn()
        .mockResolvedValue([
          tx('t1', '2026-03-01', -30000, 'hotel'),
          tx('t2', '2026-03-02', -10000, 'resto'),
          tx('t3', '2026-03-03', -5000, 'resto'),
          tx('t4', '2026-03-04', -5000, null),
          tx('t5', '2026-03-05', 2000, 'hotel'),
          tx('t6', '2026-03-06', -1000, 'resto'),
          tx('other', '2026-03-07', -99999, 'resto', ['autre']),
        ]),
    };
    periods = { findById: jest.fn().mockResolvedValue(period) };
    categories = {
      findAllByAccount: jest.fn().mockResolvedValue(
        ['hotel', 'resto'].map(
          (id) =>
            new Category({
              id,
              name: `Cat ${id}`,
              color: '#000000',
              type: CategoryType.EXPENSE,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
        ),
      ),
    };
    useCase = new GetTagDetailsUseCase(
      transactions as unknown as TransactionRepository,
      tags as unknown as TagRepository,
      periods as unknown as PeriodRepository,
      categories as unknown as CategoryRepository,
    );
  });

  it('summarizes only the transactions carrying the tag', async () => {
    const { summary } = await useCase.execute('acc-1', 'vacances');

    expect(summary).toEqual({
      tagId: 'vacances',
      name: 'Vacances',
      color: '#111111',
      totalAmount: '-49000',
      transactionCount: 6,
    });
  });

  it('breaks the tag down by category, sorted by absolute amount, with share of the absolute total', async () => {
    const { categoryBreakdown } = await useCase.execute('acc-1', 'vacances');

    // total absolu : 30000 + 10000 + 5000 + 5000 + 2000 + 1000 = 53000
    expect(categoryBreakdown).toEqual([
      {
        categoryId: 'hotel',
        name: 'Cat hotel',
        amount: '-28000',
        percentage: 52, // 52,8 % tronqué (division entière avant Math.round)
      },
      {
        categoryId: 'resto',
        name: 'Cat resto',
        amount: '-16000',
        percentage: 30,
      },
      {
        categoryId: null,
        name: 'Uncategorized',
        amount: '-5000',
        percentage: 9,
      },
    ]);
  });

  it('returns the 5 most recent transactions, newest first', async () => {
    const { recentTransactions } = await useCase.execute('acc-1', 'vacances');

    expect(recentTransactions.map((t) => t.id)).toEqual([
      't6',
      't5',
      't4',
      't3',
      't2',
    ]);
    expect(recentTransactions[0]).toEqual({
      id: 't6',
      description: 'tx t6',
      date: new Date('2026-03-06').toISOString(),
      amount: '-1000',
    });
  });

  it('restricts to the period dates when a period is given', async () => {
    await useCase.execute('acc-1', 'vacances', 'per-1');

    expect(transactions.findAllByAccountUnpaginated).toHaveBeenCalledWith(
      'acc-1',
      { startDate: period.startDate, endDate: period.endDate },
    );
  });

  it('rejects an unknown tag', async () => {
    tags.findById.mockResolvedValue(null);

    await expect(useCase.execute('acc-1', 'vacances')).rejects.toThrow(
      'Tag not found',
    );
  });

  it('rejects a tag belonging to another account', async () => {
    await expect(useCase.execute('acc-2', 'vacances')).rejects.toThrow(
      'Tag not found',
    );
    expect(transactions.findAllByAccountUnpaginated).not.toHaveBeenCalled();
  });

  it('rejects a period of another account', async () => {
    periods.findById.mockResolvedValue({ ...period, accountId: 'acc-2' });
    await expect(useCase.execute('acc-1', 'vacances', 'per-1')).rejects.toThrow(
      'Period not found',
    );
    expect(transactions.findAllByAccountUnpaginated).not.toHaveBeenCalled();
  });

  it('returns empty details for a tag without transactions', async () => {
    transactions.findAllByAccountUnpaginated.mockResolvedValue([]);

    expect(await useCase.execute('acc-1', 'vacances')).toEqual({
      summary: expect.objectContaining({
        totalAmount: '0',
        transactionCount: 0,
      }) as unknown,
      categoryBreakdown: [],
      recentTransactions: [],
    });
  });
});
