import { Test, TestingModule } from '@nestjs/testing';
import { CreatePeriodWithBudgetsUseCase } from './create-period-with-budgets.use-case';
import { PeriodRepository } from '../domain/period.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';

describe('CreatePeriodWithBudgetsUseCase', () => {
  let useCase: CreatePeriodWithBudgetsUseCase;
  let periodRepo: PeriodRepository;
  let budgetRepo: BudgetRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePeriodWithBudgetsUseCase,
        {
          provide: PeriodRepository,
          useValue: {
            save: jest.fn(),
            findAllByAccount: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: BudgetRepository, useValue: { saveBulk: jest.fn() } },
        {
          provide: RecurringTransactionRepository,
          useValue: { findAllByAccount: jest.fn().mockResolvedValue([]) },
        },
        { provide: TransactionRepository, useValue: { save: jest.fn() } },
      ],
    }).compile();

    useCase = module.get<CreatePeriodWithBudgetsUseCase>(
      CreatePeriodWithBudgetsUseCase,
    );
    periodRepo = module.get<PeriodRepository>(PeriodRepository);
    budgetRepo = module.get<BudgetRepository>(BudgetRepository);
  });

  it('should create and save a period with its budgets', async () => {
    const command = {
      accountId: 'acc-1',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-10'),
      budgets: [
        { categoryId: 'cat-1', amountAllocated: BigInt(-1000) },
        { categoryId: 'cat-2', amountAllocated: BigInt(-500) },
      ],
    };

    const result = await useCase.execute(command);

    expect(result.period.id).toBeDefined();
    expect(result.budgets).toHaveLength(2);
    expect(periodRepo.save).toHaveBeenCalled();
    expect(budgetRepo.saveBulk).toHaveBeenCalled();
  });
});
