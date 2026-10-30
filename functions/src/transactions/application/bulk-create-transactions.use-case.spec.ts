import { BulkCreateTransactionsUseCase } from './bulk-create-transactions.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { MatchSmartRulesUseCase } from '../../smart-rules/application/match-smart-rules.use-case';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { DomainValidationError } from '../../shared/domain/errors';

describe('BulkCreateTransactionsUseCase', () => {
  let repository: { saveMany: jest.Mock; save: jest.Mock };
  let matchRules: { execute: jest.Mock };
  let useCase: BulkCreateTransactionsUseCase;
  let refs: jest.Mocked<AccountReferencesService>;

  const line = (overrides: Record<string, unknown> = {}) => ({
    categoryId: null as string | null,
    date: new Date('2026-03-01'),
    description: 'CB CARREFOUR',
    amount: BigInt(-4250),
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      saveMany: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
    };
    matchRules = {
      execute: jest.fn().mockResolvedValue({ categoryId: null, tagIds: [] }),
    };
    refs = {
      ensureReferences: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccountReferencesService>;
    useCase = new BulkCreateTransactionsUseCase(
      repository as unknown as TransactionRepository,
      matchRules as unknown as MatchSmartRulesUseCase,
      refs,
    );
  });

  it('creates one transaction per line on the given account and saves them in one atomic call', async () => {
    const result = await useCase.execute({
      accountId: 'acc-1',
      transactions: [line(), line({ description: 'SNCF' })],
    });

    expect(result).toHaveLength(2);
    expect(result.every((t) => t.accountId === 'acc-1')).toBe(true);
    expect(repository.saveMany).toHaveBeenCalledTimes(1);
    expect(repository.saveMany).toHaveBeenCalledWith(result);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('refuses the whole import, before any write, when a later line references another account', async () => {
    refs.ensureReferences
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new DomainValidationError('Category does not belong to this account'),
      );

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        transactions: [line(), line({ categoryId: 'cat-foreign' })],
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(repository.saveMany).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
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
    expect(repository.saveMany).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('writes nothing when a later line is invalid', async () => {
    await expect(
      useCase.execute({
        accountId: 'acc-1',
        transactions: [line(), line({ description: '' })],
      }),
    ).rejects.toThrow('Description is required');
    expect(repository.saveMany).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('propagates the error of the atomic call; no line is written separately', async () => {
    repository.saveMany.mockRejectedValue(new Error('db down'));

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        transactions: [line(), line({ description: 'SNCF' })],
      }),
    ).rejects.toThrow('db down');
    expect(repository.saveMany).toHaveBeenCalledTimes(1);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('passes the tags (user and rule) of each line to the atomic call', async () => {
    matchRules.execute.mockResolvedValue({
      categoryId: null,
      tagIds: ['tag-rule'],
    });

    await useCase.execute({
      accountId: 'acc-1',
      transactions: [line({ tagIds: ['tag-user'] }), line()],
    });

    const [saved] = repository.saveMany.mock.calls[0] as [
      Array<{ tagIds: string[] }>,
    ];
    expect(saved.map((t) => t.tagIds)).toEqual([
      ['tag-user', 'tag-rule'],
      ['tag-rule'],
    ]);
  });
});
