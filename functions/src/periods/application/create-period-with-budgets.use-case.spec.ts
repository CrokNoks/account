import { CreatePeriodWithBudgetsUseCase } from './create-period-with-budgets.use-case';
import { PeriodRepository } from '../domain/period.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { RecurringTransaction } from '../../recurring/domain/recurring-transaction.entity';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { Logger } from '@nestjs/common';
import { Period } from '../domain/period.entity';
import {
  DomainValidationError,
  PeriodBeforeExistingError,
} from '../../shared/domain/errors';

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
      findAllByAccount: jest.fn().mockResolvedValue([]),
    };
    recurringRepo = { findAllByAccount: jest.fn().mockResolvedValue([]) };
    useCase = new CreatePeriodWithBudgetsUseCase(
      periodRepo as unknown as PeriodRepository,
      recurringRepo as unknown as RecurringTransactionRepository,
      refs as unknown as AccountReferencesService,
    );
  });

  const existing = (start: string, end: string, accountId = 'acc-1') =>
    Period.create({
      accountId,
      startDate: new Date(start),
      endDate: new Date(end),
      isActive: false,
    });

  it('refuses a period that starts before an existing period of the account, and writes nothing', async () => {
    periodRepo.findAllByAccount.mockResolvedValue([
      existing('2026-04-01', '2026-04-30'),
    ]);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      PeriodBeforeExistingError,
    );
    expect(periodRepo.createWithBudgets).not.toHaveBeenCalled();
  });

  it('accepts a period after the existing ones, the first period of an account, and ignores other accounts', async () => {
    await expect(useCase.execute(command)).resolves.toBeDefined();

    periodRepo.findAllByAccount.mockResolvedValue([
      existing('2026-02-01', '2026-02-28'),
      existing('2026-06-01', '2026-06-30', 'acc-2'),
    ]);
    await expect(useCase.execute(command)).resolves.toBeDefined();
    expect(periodRepo.createWithBudgets).toHaveBeenCalledTimes(2);
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

  it('passes the pending transactions generated from recurring ones in the same call', async () => {
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
        pending: boolean;
        amount: bigint;
        metadata: object;
      }>,
    ];
    expect(period).toBe(result.period);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      pending: true,
      amount: BigInt(-50000),
      metadata: { source: 'recurring' },
    });
  });

  it('stamps each generated transaction with its due date (the occurrence date)', async () => {
    recurringRepo.findAllByAccount.mockResolvedValue([
      RecurringTransaction.create({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        description: 'Loyer',
        amount: BigInt(-50000),
        dayOfMonth: 5,
      }),
    ]);

    await useCase.execute({
      ...command,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-04-10'),
      injectRecurring: true,
    });

    const [, , transactions] = periodRepo.createWithBudgets.mock.calls[0] as [
      unknown,
      unknown,
      Array<{ date: Date; metadata: Record<string, unknown> }>,
    ];
    expect(transactions.map((t) => t.metadata.dueDate)).toEqual([
      '2026-03-05',
      '2026-04-05',
    ]);
    expect(transactions.map((t) => t.date.toISOString().slice(0, 10))).toEqual([
      '2026-03-05',
      '2026-04-05',
    ]);
  });

  describe('recurring occurrences over a period of any dates', () => {
    const recurring = (dayOfMonth: number) =>
      RecurringTransaction.create({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        description: 'Loyer',
        amount: BigInt(-50000),
        dayOfMonth,
      });
    const injectedDates = () =>
      (
        periodRepo.createWithBudgets.mock.calls[0] as [
          unknown,
          unknown,
          Array<{ date: Date }>,
        ]
      )[2].map((t) => t.date.toISOString().slice(0, 10));

    it('injects the day 5 of a period spanning two months (25 Oct to 24 Nov)', async () => {
      recurringRepo.findAllByAccount.mockResolvedValue([recurring(5)]);

      await useCase.execute({
        ...command,
        startDate: new Date('2026-10-25'),
        endDate: new Date('2026-11-24'),
        injectRecurring: true,
      });

      expect(injectedDates()).toEqual(['2026-11-05']);
    });

    it('injects several occurrences when the period is longer than a month', async () => {
      recurringRepo.findAllByAccount.mockResolvedValue([recurring(5)]);

      await useCase.execute({
        ...command,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-12-31'),
        injectRecurring: true,
      });

      expect(injectedDates()).toEqual([
        '2026-10-05',
        '2026-11-05',
        '2026-12-05',
      ]);
    });

    it('brings day 31 back to the last day of a short month', async () => {
      recurringRepo.findAllByAccount.mockResolvedValue([recurring(31)]);

      await useCase.execute({
        ...command,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        injectRecurring: true,
      });

      expect(injectedDates()).toEqual(['2026-02-28']);
    });

    it('injects nothing when the day falls outside the period', async () => {
      recurringRepo.findAllByAccount.mockResolvedValue([recurring(5)]);

      await useCase.execute({
        ...command,
        startDate: new Date('2026-11-06'),
        endDate: new Date('2026-12-04'),
        injectRecurring: true,
      });

      expect(injectedDates()).toEqual([]);
    });
  });

  it('logs period_opened with origin manual, without label or amount', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    const result = await useCase.execute(command);

    expect(log).toHaveBeenCalledWith({
      event: 'period_opened',
      origin: 'manual',
      accountId: 'acc-1',
      periodId: result.period.id,
      start: '2026-03-01',
      end: '2026-03-31',
      injected: 0,
      nextPaie: false,
    });
    log.mockRestore();
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
