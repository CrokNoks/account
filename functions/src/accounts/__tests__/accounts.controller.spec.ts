import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from '../accounts.controller';
import { AccountsService } from '../accounts.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: AccountsService;
  let mockReq: any;

  const mockAccount = {
    id: 'test-id',
    name: 'Test Account',
    initial_balance: 1000,
    owner_id: 'test-user-id',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    emailVerified: true,
  };

  beforeEach(async () => {
    const mockAccountsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        {
          provide: AccountsService,
          useValue: mockAccountsService,
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
    service = module.get<AccountsService>(AccountsService);
    
    mockReq = {
      user: mockUser,
    };
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of accounts', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([mockAccount]);

      const result = await controller.findAll(mockReq);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.uid, undefined);
      expect(result).toEqual([mockAccount]);
    });

    it('should call service with account_id when provided', async () => {
      const accountId = 'specific-account-id';
      jest.spyOn(service, 'findAll').mockResolvedValue([mockAccount]);

      await controller.findAll(mockReq, accountId);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.uid, accountId);
    });
  });

  describe('findOne', () => {
    it('should return a single account', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockAccount);

      const result = await controller.findOne(mockReq, 'test-id');

      expect(service.findOne).toHaveBeenCalledWith('test-id', mockUser.uid);
      expect(result).toEqual(mockAccount);
    });
  });

  describe('create', () => {
    it('should create a new account', async () => {
      const createAccountDto = {
        name: 'New Account',
        initial_balance: 500,
        type: 'checking',
        currency: 'EUR',
      };

      jest.spyOn(service, 'create').mockResolvedValue(mockAccount);

      const result = await controller.create(mockReq, createAccountDto);

      expect(service.create).toHaveBeenCalledWith(mockUser.uid, createAccountDto);
      expect(result).toEqual(mockAccount);
    });
  });

  describe('update', () => {
    it('should update an account', async () => {
      const updateAccountDto = {
        name: 'Updated Account',
        initial_balance: 1500,
      };

      jest.spyOn(service, 'update').mockResolvedValue(mockAccount);

      const result = await controller.update(mockReq, 'test-id', updateAccountDto);

      expect(service.update).toHaveBeenCalledWith('test-id', mockUser.uid, updateAccountDto);
      expect(result).toEqual(mockAccount);
    });
  });

  describe('remove', () => {
    it('should remove an account', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      await controller.remove(mockReq, 'test-id');

      expect(service.remove).toHaveBeenCalledWith('test-id', mockUser.uid);
    });
  });
});