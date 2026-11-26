import { Logger } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors';
import { Period } from '../domain/period.entity';
import { PeriodRepository } from '../domain/period.repository.interface';
import { DeletePeriodUseCase } from './delete-period.use-case';

describe('DeletePeriodUseCase', () => {
  const ACC = 'acc-1';
  const period = Period.create({
    id: 'p-new',
    accountId: ACC,
    startDate: new Date('2026-11-25'),
    endDate: new Date('2026-12-24'),
    isActive: true,
  });
  const result = {
    removedPending: 4,
    keptTransactions: 5,
    reopenedPeriodId: 'p-old',
    origin: 'trigger' as const,
  };

  let repo: {
    findById: jest.Mock;
    delete: jest.Mock;
    previewDelete: jest.Mock;
  };
  let useCase: DeletePeriodUseCase;
  let log: jest.SpyInstance;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue(period),
      delete: jest.fn().mockResolvedValue(result),
      previewDelete: jest.fn(),
    };
    useCase = new DeletePeriodUseCase(repo as unknown as PeriodRepository);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it('deletes through the repository and logs period_deleted without label or amount', async () => {
    await useCase.execute({ accountId: ACC, periodId: 'p-new' });

    expect(repo.delete).toHaveBeenCalledWith('p-new');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      event: 'period_deleted',
      accountId: ACC,
      periodId: 'p-new',
      removedPending: 4,
      keptTransactions: 5,
      reopenedPeriodId: 'p-old',
      origin: 'trigger',
    });
  });

  it('logs reopenedPeriodId null for a manual period', async () => {
    repo.delete.mockResolvedValue({
      ...result,
      reopenedPeriodId: null,
      origin: 'manual',
    });
    await useCase.execute({ accountId: ACC, periodId: 'p-new' });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ reopenedPeriodId: null, origin: 'manual' }),
    );
  });

  it('refuses a period of another account (404) and neither deletes nor logs', async () => {
    await expect(
      useCase.execute({ accountId: 'acc-2', periodId: 'p-new' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('refuses an unknown period (404)', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ accountId: ACC, periodId: 'nope' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('does not log when the deletion fails (read-only, conflict): the error goes through', async () => {
    repo.delete.mockRejectedValue(new ForbiddenError('read only'));
    await expect(
      useCase.execute({ accountId: ACC, periodId: 'p-new' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(log).not.toHaveBeenCalled();
  });

  it('previews through the repository after the ownership check, without logging or writing', async () => {
    const plan = {
      removedPending: 4,
      keptTransactions: 5,
      reopen: {
        periodId: 'p-old',
        startDate: '2026-10-25',
        endDate: '2026-11-30',
      },
      origin: 'trigger' as const,
    };
    repo.previewDelete.mockResolvedValue(plan);

    expect(await useCase.preview({ accountId: ACC, periodId: 'p-new' })).toBe(
      plan,
    );
    expect(repo.delete).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();

    await expect(
      useCase.preview({ accountId: 'acc-2', periodId: 'p-new' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
