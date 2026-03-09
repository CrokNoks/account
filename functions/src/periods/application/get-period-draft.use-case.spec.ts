import { Test, TestingModule } from '@nestjs/testing';
import { GetPeriodDraftUseCase } from './get-period-draft.use-case';
import { PeriodRepository } from '../domain/period.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { Period } from '../domain/period.entity';
import { RecurringTransaction } from '../../recurring/domain/recurring-transaction.entity';

describe('GetPeriodDraftUseCase', () => {
  let useCase: GetPeriodDraftUseCase;
  let periodRepo: PeriodRepository;
  let budgetRepo: BudgetRepository;
  let categoryRepo: CategoryRepository;
  let recurringRepo: RecurringTransactionRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPeriodDraftUseCase,
        { provide: PeriodRepository, useValue: { findLastByAccount: jest.fn() } },
        { provide: BudgetRepository, useValue: { getHistoricalStatsByAccount: jest.fn() } },
        { provide: CategoryRepository, useValue: { findAllByAccount: jest.fn() } },
        { provide: RecurringTransactionRepository, useValue: { findAllByAccount: jest.fn() } },
      ],
    }).compile();

    useCase = module.get<GetPeriodDraftUseCase>(GetPeriodDraftUseCase);
    periodRepo = module.get<PeriodRepository>(PeriodRepository);
    budgetRepo = module.get<BudgetRepository>(BudgetRepository);
    categoryRepo = module.get<CategoryRepository>(CategoryRepository);
    recurringRepo = module.get<RecurringTransactionRepository>(RecurringTransactionRepository);
  });

  it('should suggest dates based on last period (1 month minus 1 day)', async () => {
    const lastPeriod = Period.create({
      accountId: 'acc-1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
    });
    (periodRepo.findLastByAccount as jest.Mock).mockResolvedValue(lastPeriod);
    (budgetRepo.getHistoricalStatsByAccount as jest.Mock).mockResolvedValue([]);
    (categoryRepo.findAllByAccount as jest.Mock).mockResolvedValue([]);
    (recurringRepo.findAllByAccount as jest.Mock).mockResolvedValue([]);

    const result = await useCase.execute('acc-1');

    expect(result.suggestedStartDate).toEqual(new Date('2026-01-11'));
    // 2026-01-11 + 1 month - 1 day = 2026-02-10
    expect(result.suggestedEndDate).toEqual(new Date('2026-02-10'));
  });

  it('should include category stats and use avgReal when no recurring transactions exist', async () => {
    (periodRepo.findLastByAccount as jest.Mock).mockResolvedValue(null);
    (budgetRepo.getHistoricalStatsByAccount as jest.Mock).mockResolvedValue([
      { categoryId: 'cat-1', minReal: BigInt(-100), maxReal: BigInt(-500), avgReal: BigInt(-300) }
    ]);
    (categoryRepo.findAllByAccount as jest.Mock).mockResolvedValue([
      { id: 'cat-1', name: 'Food' }
    ]);
    (recurringRepo.findAllByAccount as jest.Mock).mockResolvedValue([]);

    const result = await useCase.execute('acc-1');

    expect(result.categoriesWithStats).toHaveLength(1);
    expect(result.categoriesWithStats[0].name).toBe('Food');
    expect(result.categoriesWithStats[0].avgReal).toBe('-300');
    expect(result.categoriesWithStats[0].defaultAllocated).toBe('-300'); // defaults to avgReal
  });

  it('should prioritize recurring transactions sum over avgReal for defaultAllocated', async () => {
    (periodRepo.findLastByAccount as jest.Mock).mockResolvedValue(null);
    (budgetRepo.getHistoricalStatsByAccount as jest.Mock).mockResolvedValue([
      { categoryId: 'cat-1', minReal: BigInt(-100), maxReal: BigInt(-500), avgReal: BigInt(-300) }
    ]);
    (categoryRepo.findAllByAccount as jest.Mock).mockResolvedValue([
      { id: 'cat-1', name: 'Food' }
    ]);
    
    // Simulate 2 recurring transactions for cat-1
    const recTx1 = RecurringTransaction.create({ accountId: 'acc-1', categoryId: 'cat-1', description: 't1', amount: BigInt(-200), dayOfMonth: 1 });
    const recTx2 = RecurringTransaction.create({ accountId: 'acc-1', categoryId: 'cat-1', description: 't2', amount: BigInt(-150), dayOfMonth: 5 });
    
    (recurringRepo.findAllByAccount as jest.Mock).mockResolvedValue([recTx1, recTx2]);

    const result = await useCase.execute('acc-1');

    expect(result.categoriesWithStats).toHaveLength(1);
    expect(result.categoriesWithStats[0].name).toBe('Food');
    expect(result.categoriesWithStats[0].avgReal).toBe('-300');
    // Sum of recurring is -350
    expect(result.categoriesWithStats[0].defaultAllocated).toBe('-350');
  });
});
