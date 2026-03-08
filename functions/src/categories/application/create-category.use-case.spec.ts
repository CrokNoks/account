import { Test, TestingModule } from '@nestjs/testing';
import { CreateCategoryUseCase, CreateCategoryCommand } from './create-category.use-case';
import { CategoryRepository } from '../domain/category.repository.interface';
import { CategoryType } from '../domain/category.entity';

describe('CreateCategoryUseCase', () => {
  let useCase: CreateCategoryUseCase;
  let repository: CategoryRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCategoryUseCase,
        {
          provide: CategoryRepository,
          useValue: {
            save: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get<CreateCategoryUseCase>(CreateCategoryUseCase);
    repository = module.get<CategoryRepository>(CategoryRepository);
  });

  it('should create and save a new category', async () => {
    const command: CreateCategoryCommand = {
      name: 'Internet',
      color: '#3498db',
      type: CategoryType.EXPENSE,
      accountId: 'acc-1',
      userId: 'user-1',
      budget: BigInt(5000),
    };

    const result = await useCase.execute(command);

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Internet');
    expect(repository.save).toHaveBeenCalled();
  });
});
