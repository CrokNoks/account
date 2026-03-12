import { CreateAccountUseCase } from './create-account.use-case';
import { AccountRepository } from '../domain/account.repository.interface';
import { Account } from '../domain/account.entity';

describe('CreateAccountUseCase', () => {
  let useCase: CreateAccountUseCase;
  let repository: jest.Mocked<AccountRepository>;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findAllForUser: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<AccountRepository>;
    useCase = new CreateAccountUseCase(repository);
  });

  it('should create a new account with default balance of 0', async () => {
    const input = {
      name: 'Test Account',
      ownerId: 'user-123',
    };

    const result = await useCase.execute(input);

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Test Account');
    expect(result.ownerId).toBe('user-123');
    expect(result.initialBalance).toBe(0n);
    expect(repository.save).toHaveBeenCalled();
  });

  it('should create a new account with a specific balance', async () => {
    const input = {
      name: 'Savings',
      ownerId: 'user-123',
      initialBalance: 50000n, // 500.00 euros
    };

    const result = await useCase.execute(input);

    expect(result.initialBalance).toBe(50000n);
    expect(repository.save).toHaveBeenCalledWith(expect.any(Account));
  });
});
