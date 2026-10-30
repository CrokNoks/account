import { GetTagsSummaryUseCase } from './get-tags-summary.use-case';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { TagRepository } from '../../tags/domain/tag.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { Tag } from '../../tags/domain/tag.entity';
import { Period } from '../../periods/domain/period.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';

const tag = (id: string, color = '#111111') =>
  Tag.create({ id, accountId: 'acc-1', name: `Tag ${id}`, color });

const tx = (amount: number, tagIds: string[]) =>
  Transaction.create({
    accountId: 'acc-1',
    categoryId: null,
    date: new Date('2026-03-10'),
    description: 'tx',
    amount: BigInt(amount),
    reconciled: false,
    pending: false,
    tagIds,
  });

describe('GetTagsSummaryUseCase', () => {
  const period = Period.create({
    id: 'per-1',
    accountId: 'acc-1',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-31'),
  });

  let transactions: { findAllByAccountUnpaginated: jest.Mock };
  let tags: { findAllByAccount: jest.Mock };
  let periods: { findById: jest.Mock };
  let useCase: GetTagsSummaryUseCase;

  beforeEach(() => {
    transactions = {
      findAllByAccountUnpaginated: jest
        .fn()
        .mockResolvedValue([
          tx(-10000, ['vacances']),
          tx(-5000, ['vacances', 'resto']),
          tx(-500, ['resto']),
          tx(-99, []),
        ]),
    };
    tags = {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([tag('resto'), tag('vacances'), tag('vide', '')]),
    };
    periods = { findById: jest.fn().mockResolvedValue(period) };
    useCase = new GetTagsSummaryUseCase(
      transactions as unknown as TransactionRepository,
      tags as unknown as TagRepository,
      periods as unknown as PeriodRepository,
    );
  });

  it('totals amount and count per tag, a transaction counting for each of its tags', async () => {
    const summary = await useCase.execute('acc-1');

    expect(summary.find((s) => s.tagId === 'vacances')).toEqual({
      tagId: 'vacances',
      name: 'Tag vacances',
      color: '#111111',
      totalAmount: '-15000',
      transactionCount: 2,
    });
    expect(summary.find((s) => s.tagId === 'resto')).toMatchObject({
      totalAmount: '-5500',
      transactionCount: 2,
    });
  });

  it('lists unused tags with 0 and a default grey color when the tag has none', async () => {
    const summary = await useCase.execute('acc-1');

    expect(summary.find((s) => s.tagId === 'vide')).toEqual({
      tagId: 'vide',
      name: 'Tag vide',
      color: '#94a3b8',
      totalAmount: '0',
      transactionCount: 0,
    });
  });

  it('sorts by absolute total, largest first', async () => {
    transactions.findAllByAccountUnpaginated.mockResolvedValue([
      tx(-100, ['resto']),
      tx(20000, ['vacances']),
    ]);

    const summary = await useCase.execute('acc-1');

    expect(summary.map((s) => s.tagId)).toEqual(['vacances', 'resto', 'vide']);
  });

  it('restricts to the period dates when a period is given', async () => {
    await useCase.execute('acc-1', 'per-1');

    expect(transactions.findAllByAccountUnpaginated).toHaveBeenCalledWith(
      'acc-1',
      { startDate: period.startDate, endDate: period.endDate },
    );
  });

  it('uses every transaction when no period is given', async () => {
    await useCase.execute('acc-1');

    expect(transactions.findAllByAccountUnpaginated.mock.calls).toEqual([
      ['acc-1', { startDate: undefined, endDate: undefined }],
    ]);
  });

  it('rejects an unknown period or a period of another account, without reading transactions', async () => {
    periods.findById.mockResolvedValueOnce(null);
    await expect(useCase.execute('acc-1', 'unknown')).rejects.toThrow(
      'Period not found',
    );

    await expect(useCase.execute('acc-other', 'per-1')).rejects.toThrow(
      'Period not found',
    );
    expect(transactions.findAllByAccountUnpaginated).not.toHaveBeenCalled();
  });
});
