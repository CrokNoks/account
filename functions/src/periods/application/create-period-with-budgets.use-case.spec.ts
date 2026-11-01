import { CreatePeriodWithBudgetsUseCase } from './create-period-with-budgets.use-case';
import { PeriodRepository } from '../domain/period.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { RecurringTransaction } from '../../recurring/domain/recurring-transaction.entity';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { DomainValidationError } from '../../shared/domain/errors';

describe('CreatePeriodWithBudgetsUseCase', () => {
  let useCase: CreatePeriodWithBudgetsUseCase;
  let periodRepo: {
    createWithBudgets: jest.Mock;
    save: jest.Mock;
    findAllByAccount: jest.Mock;
  };
  let recurringRepo: { findAllByAccount: jest.Mock };
  let refs: { ensureCategories: jest.Mock };

  const command = {
    accountId: 'acc-1',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-31'),
    budgets: [
      { categoryId: 'cat-1', amountAllocated: BigInt(-1000) },
      { categoryId: 'cat-2', amountAllocated: BigInt(-500) },
    ],
  };

  beforeEach(() => {
    refs = { ensureCategories: jest.fn().mockResolvedValue(undefined) };
    periodRepo = {
      createWithBudgets: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
      findAllByAccount: jest.fn(),
    };
    recurringRepo = { findAllByAccount: jest.fn().mockResolvedValue([]) };
    useCase = new CreatePeriodWithBudgetsUseCase(
      periodRepo as unknown as PeriodRepository,
      recurringRepo as unknown as RecurringTransactionRepository,
      refs as unknown as AccountReferencesService,
    );
  });

  it('writes the period and its budgets in one atomic call', async () => {
    const result = await useCase.execute(command);

    expect(result.period.id).toBeDefined();
    expect(result.budgets).toHaveLength(2);
    expect(periodRepo.createWithBudgets).toHaveBeenCalledTimes(1);
    expect(periodRepo.createWithBudgets).toHaveBeenCalledWith(
      result.period,
      result.budgets,
      [],
    );
    expect(result.budgets.every((b) => b.periodId === result.period.id)).toBe(
      true,
    );
    // plus aucune écriture séparée (désactivation des autres périodes comprise)
    expect(periodRepo.save).not.toHaveBeenCalled();
  });

  // Une récurrente générée est « à venir » (comptée dans le solde à venir, non rapprochée),
  // pas « en attente » (opération autorisée non comptabilisée, exclue des soldes).
  it('passes the upcoming transactions generated from recurring ones in the same call', async () => {
    recurringRepo.findAllByAccount.mockResolvedValue([
      RecurringTransaction.create({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        description: 'Loyer',
        amount: BigInt(-50000),
        dayOfMonth: 5,
      }),
    ]);

    const result = await useCase.execute({ ...command, injectRecurring: true });

    expect(periodRepo.createWithBudgets).toHaveBeenCalledTimes(1);
    const [period, , transactions] = periodRepo.createWithBudgets.mock
      .calls[0] as [
      { id: string },
      unknown,
      Array<{
        periodId: string;
        pending: boolean;
        reconciled: boolean;
        amount: bigint;
        metadata: object;
      }>,
    ];
    expect(period).toBe(result.period);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      periodId: result.period.id,
      pending: false,
      reconciled: false,
      amount: BigInt(-50000),
      metadata: { source: 'recurring' },
    });
  });

  it('does not read recurring transactions unless asked', async () => {
    await useCase.execute(command);

    expect(recurringRepo.findAllByAccount).not.toHaveBeenCalled();
  });

  it('propagates the error of the atomic call; nothing else is written', async () => {
    periodRepo.createWithBudgets.mockRejectedValue(new Error('db down'));

    await expect(useCase.execute(command)).rejects.toThrow('db down');
    expect(periodRepo.createWithBudgets).toHaveBeenCalledTimes(1);
    expect(periodRepo.save).not.toHaveBeenCalled();
  });

  it('refuses a budget category of another account without any write', async () => {
    refs.ensureCategories.mockRejectedValue(
      new DomainValidationError('Category does not belong to this account'),
    );

    await expect(
      useCase.execute({
        ...command,
        budgets: [{ categoryId: 'cat-foreign', amountAllocated: BigInt(-1) }],
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(periodRepo.createWithBudgets).not.toHaveBeenCalled();
    expect(periodRepo.save).not.toHaveBeenCalled();
  });
});
