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
        {
          provide: PeriodRepository,
          useValue: { findLastByAccount: jest.fn() },
        },
        {
          provide: BudgetRepository,
          useValue: {
            getHistoricalStatsByAccount: jest.fn(),
            findTemplatesByAccount: jest.fn(),
          },
        },
        {
          provide: CategoryRepository,
          useValue: { findAllByAccount: jest.fn() },
        },
      ],
    }).compile();

    useCase = module.get<GetPeriodDraftUseCase>(GetPeriodDraftUseCase);
    periodRepo = module.get<PeriodRepository>(PeriodRepository);
    budgetRepo = module.get<BudgetRepository>(BudgetRepository);
    categoryRepo = module.get<CategoryRepository>(CategoryRepository);
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
    (budgetRepo.findTemplatesByAccount as jest.Mock).mockResolvedValue([]);

    const result = await useCase.execute('acc-1');

    expect(result.suggestedStartDate).toEqual(new Date('2026-01-11'));
    // 2026-01-11 + 1 month - 1 day = 2026-02-10
    expect(result.suggestedEndDate).toEqual(new Date('2026-02-10'));
  });

  const stat = {
    categoryId: 'cat-1',
    minReal: BigInt(-100),
    maxReal: BigInt(-500),
    avgReal: BigInt(30000),
  };

  function givenAccount(opts: {
    templates?: Array<{ categoryId: string; amount: bigint }>;
    stats?: unknown[];
    categories?: Array<{ id: string; name: string }>;
  }) {
    (periodRepo.findLastByAccount as jest.Mock).mockResolvedValue(null);
    (budgetRepo.findTemplatesByAccount as jest.Mock).mockResolvedValue(
      opts.templates ?? [],
    );
    (budgetRepo.getHistoricalStatsByAccount as jest.Mock).mockResolvedValue(
      opts.stats ?? [],
    );
    (categoryRepo.findAllByAccount as jest.Mock).mockResolvedValue(
      opts.categories ?? [{ id: 'cat-1', name: 'Food' }],
    );
  }

  it('uses the configured amount, stats stay indicative (CA1)', async () => {
    givenAccount({
      templates: [{ categoryId: 'cat-1', amount: 50000n }],
      stats: [stat],
    });

    const result = await useCase.execute('acc-1');

    const c = result.categoriesWithStats[0];
    expect(c.defaultAllocated).toBe('50000');
    expect(c.avgReal).toBe('30000');
    expect(c.minReal).toBe('-100');
    expect(c.maxReal).toBe('-500');
  });

  it('proposes 0 when not configured, whatever the history (CA2)', async () => {
    givenAccount({ stats: [stat] });

    const result = await useCase.execute('acc-1');

    expect(result.categoriesWithStats[0].defaultAllocated).toBe('0');
    expect(result.categoriesWithStats[0].avgReal).toBe('30000');
  });

  it('proposes 0 for every category of an account without period nor configuration (CA2)', async () => {
    givenAccount({
      categories: [
        { id: 'cat-1', name: 'Food' },
        { id: 'cat-2', name: 'Rent' },
      ],
    });

    const result = await useCase.execute('acc-1');

    expect(result.categoriesWithStats.map((c) => c.defaultAllocated)).toEqual([
      '0',
      '0',
    ]);
  });

  it('proposes 0 for a line configured at 0', async () => {
    givenAccount({
      templates: [{ categoryId: 'cat-1', amount: 0n }],
      stats: [stat],
    });

    const result = await useCase.execute('acc-1');

    expect(result.categoriesWithStats[0].defaultAllocated).toBe('0');
  });

  it('keeps a negative configured amount', async () => {
    givenAccount({ templates: [{ categoryId: 'cat-1', amount: -8000n }] });

    const result = await useCase.execute('acc-1');

    expect(result.categoriesWithStats[0].defaultAllocated).toBe('-8000');
  });

  it('ignores the configuration of a category that no longer exists', async () => {
    givenAccount({ templates: [{ categoryId: 'deleted', amount: 100n }] });

    const result = await useCase.execute('acc-1');

    expect(result.categoriesWithStats).toHaveLength(1);
    expect(result.categoriesWithStats[0].defaultAllocated).toBe('0');
  });

  it('suggests today (calendar date in the business time zone) when there is no period yet', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-31T23:30:00Z')); // 1er nov. à Paris
    (periodRepo.findLastByAccount as jest.Mock).mockResolvedValue(null);
    (budgetRepo.getHistoricalStatsByAccount as jest.Mock).mockResolvedValue([]);
    (categoryRepo.findAllByAccount as jest.Mock).mockResolvedValue([]);
    (budgetRepo.findTemplatesByAccount as jest.Mock).mockResolvedValue([]);

    const result = await useCase.execute('acc-1');
    jest.useRealTimers();

    expect(result.suggestedStartDate.toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
    expect(result.suggestedEndDate.toISOString()).toBe(
      '2026-11-30T00:00:00.000Z',
    );
  });
});
