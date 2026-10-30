import { BulkCreateTransactionsUseCase } from './bulk-create-transactions.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { MatchSmartRulesUseCase } from '../../smart-rules/application/match-smart-rules.use-case';

describe('BulkCreateTransactionsUseCase', () => {
  let repository: { save: jest.Mock };
  let matchRules: { execute: jest.Mock };
  let useCase: BulkCreateTransactionsUseCase;

  const line = (overrides: Record<string, unknown> = {}) => ({
    categoryId: null as string | null,
    date: new Date('2026-03-01'),
    description: 'CB CARREFOUR',
    amount: BigInt(-4250),
    ...overrides,
  });

  beforeEach(() => {
    repository = { save: jest.fn().mockResolvedValue(undefined) };
    matchRules = {
      execute: jest.fn().mockResolvedValue({ categoryId: null, tagIds: [] }),
    };
    useCase = new BulkCreateTransactionsUseCase(
      repository as unknown as TransactionRepository,
      matchRules as unknown as MatchSmartRulesUseCase,
    );
  });

  it('creates and saves one transaction per line on the given account', async () => {
    const result = await useCase.execute({
      accountId: 'acc-1',
      transactions: [line(), line({ description: 'SNCF' })],
    });

    expect(result).toHaveLength(2);
    expect(result.every((t) => t.accountId === 'acc-1')).toBe(true);
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it('applies smart rules to lines without category', async () => {
    matchRules.execute.mockResolvedValue({
      categoryId: 'cat-courses',
      tagIds: ['tag-rule'],
    });

    const [tx] = await useCase.execute({
      accountId: 'acc-1',
      transactions: [line({ tagIds: ['tag-user'] })],
    });

    expect(matchRules.execute).toHaveBeenCalledWith('acc-1', 'CB CARREFOUR');
    expect(tx.categoryId).toBe('cat-courses');
    expect(tx.tagIds).toEqual(['tag-user', 'tag-rule']);
  });

  it('does not call smart rules when a category is provided', async () => {
    const [tx] = await useCase.execute({
      accountId: 'acc-1',
      transactions: [line({ categoryId: 'cat-manual' })],
    });

    expect(matchRules.execute).not.toHaveBeenCalled();
    expect(tx.categoryId).toBe('cat-manual');
  });

  it('defaults reconciled and pending to false', async () => {
    const [tx] = await useCase.execute({
      accountId: 'acc-1',
      transactions: [line()],
    });

    expect(tx.reconciled).toBe(false);
    expect(tx.pending).toBe(false);
  });

  it('converts the amount to bigint and the date to a Date', async () => {
    const [tx] = await useCase.execute({
      accountId: 'acc-1',
      transactions: [
        line({ amount: -1234 as unknown as bigint, date: '2026-04-02' }),
      ],
    });

    expect(tx.amount).toBe(BigInt(-1234));
    expect(tx.date).toEqual(new Date('2026-04-02'));
  });

  it('returns an empty list for an empty import', async () => {
    expect(
      await useCase.execute({ accountId: 'acc-1', transactions: [] }),
    ).toEqual([]);
    expect(repository.save).not.toHaveBeenCalled();
  });

  // Comportement actuel documenté (docs/transactions.md) : l'import n'est pas atomique.
  it('keeps already saved lines when a later line fails', async () => {
    await expect(
      useCase.execute({
        accountId: 'acc-1',
        transactions: [line(), line({ description: '' })],
      }),
    ).rejects.toThrow('Description is required');
    expect(repository.save).toHaveBeenCalledTimes(1);
  });
});
