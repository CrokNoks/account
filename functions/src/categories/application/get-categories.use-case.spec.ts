import { Test, TestingModule } from '@nestjs/testing';
import { GetCategoriesUseCase } from './get-categories.use-case';
import { CategoryRepository } from '../domain/category.repository.interface';
import { Category, CategoryType } from '../domain/category.entity';

describe('GetCategoriesUseCase', () => {
  let useCase: GetCategoriesUseCase;
  let repository: CategoryRepository;

  const mockCategories = [
    Category.create({ name: 'Food', color: '#e74c3c', type: CategoryType.EXPENSE, accountId: 'acc-1' }),
    Category.create({ name: 'Salary', color: '#2ecc71', type: CategoryType.INCOME, accountId: 'acc-1' }),
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCategoriesUseCase,
        {
          provide: CategoryRepository,
          useValue: {
            findAllByAccount: jest.fn().mockResolvedValue(mockCategories),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetCategoriesUseCase>(GetCategoriesUseCase);
    repository = module.get<CategoryRepository>(CategoryRepository);
  });

  it('should return categories for a given account', async () => {
    const result = await useCase.execute('acc-1');

    expect(result).toEqual(mockCategories);
    expect(repository.findAllByAccount).toHaveBeenCalledWith('acc-1');
  });
});
