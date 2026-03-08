import { GetAccountsUseCase } from './get-accounts.use-case';
import { AccountRepository } from '../domain/account.repository.interface';
import { Account } from '../domain/account.entity';

describe('GetAccountsUseCase', () => {
  let useCase: GetAccountsUseCase;
  let repository: AccountRepository;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findAllByOwner: jest.fn(),
      findById: jest.fn(),
    } as any;
    useCase = new GetAccountsUseCase(repository);
  });

  it('should return only accounts for the specified owner', async () => {
    const ownerId = 'user-1';
    const accounts = [
      new Account({ id: 'acc-1', name: 'Main', ownerId }),
      new Account({ id: 'acc-2', name: 'Savings', ownerId }),
    ];
    jest.spyOn(repository, 'findAllByOwner').mockResolvedValue(accounts);

    const result = await useCase.execute(ownerId);

    expect(result.length).toBe(2);
    expect(result[0].id).toBe('acc-1');
    expect(result[1].id).toBe('acc-2');
    expect(repository.findAllByOwner).toHaveBeenCalledWith(ownerId);
  });
});
