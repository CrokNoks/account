import { Test, TestingModule } from '@nestjs/testing';
import { GetPeriodDraftUseCase } from './get-period-draft.use-case';
import { PeriodRepository } from '../domain/period.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { Period } from '../domain/period.entity';

describe('GetPeriodDraftUseCase', () => {
  let useCase: GetPeriodDraftUseCase;
  let periodRepo: PeriodRepository;
  let budgetRepo: BudgetRepository;
  let categoryRepo: CategoryRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPeriodDraftUseCase,
        { provide: PeriodRepository, useValue: { findLastByAccount: jest.fn() } },
        { provide: BudgetRepository, useValue: { getHistoricalStatsByAccount: jest.fn() } },
        { provide: CategoryRepository, useValue: { findAllByAccount: jest.fn() } },
      ],
    }).compile();

    useCase = module.get<GetPeriodDraftUseCase>(GetPeriodDraftUseCase);
    periodRepo = module.get<PeriodRepository>(PeriodRepository);
    budgetRepo = module.get<BudgetRepository>(BudgetRepository);
    categoryRepo = module.get<CategoryRepository>(CategoryRepository);
  });

  it('should suggest dates based on last period', async () => {
    const lastPeriod = Period.create({
      accountId: 'acc-1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
    });
    (periodRepo.findLastByAccount as jest.Mock).mockResolvedValue(lastPeriod);
    (budgetRepo.getHistoricalStatsByAccount as jest.Mock).mockResolvedValue([]);
    (categoryRepo.findAllByAccount as jest.Mock).mockResolvedValue([]);

    const result = await useCase.execute('acc-1');

    expect(result.suggestedStartDate).toEqual(new Date('2026-01-11'));
    expect(result.suggestedEndDate).toEqual(new Date('2026-01-21'));
  });

  it('should include category stats', async () => {
    (periodRepo.findLastByAccount as jest.Mock).mockResolvedValue(null);
    (budgetRepo.getHistoricalStatsByAccount as jest.Mock).mockResolvedValue([
      { categoryId: 'cat-1', minReal: BigInt(-100), maxReal: BigInt(-500), avgReal: BigInt(-300) }
    ]);
    (categoryRepo.findAllByAccount as jest.Mock).mockResolvedValue([
      { id: 'cat-1', name: 'Food' }
    ]);

    const result = await useCase.execute('acc-1');

    expect(result.categoriesWithStats).toHaveLength(1);
    expect(result.categoriesWithStats[0].name).toBe('Food');
    expect(result.categoriesWithStats[0].avgReal).toBe('-300');
  });
});
