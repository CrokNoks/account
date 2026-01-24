import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from '../categories.controller';
import { CategoriesService } from '../categories.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;
  let mockReq: any;

  const mockCategory = {
    id: 'test-id',
    name: 'Test Category',
    color: '#FF5722',
    icon: 'shopping_cart',
    account_id: 'test-account-id',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    emailVerified: true,
  };

  beforeEach(async () => {
    const mockCategoriesService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);
    
    mockReq = {
      user: mockUser,
    };
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of categories', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([mockCategory]);

      const result = await controller.findAll(mockReq);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.uid, undefined);
      expect(result).toEqual([mockCategory]);
    });

    it('should call service with account_id when provided', async () => {
      const accountId = 'test-account-id';
      jest.spyOn(service, 'findAll').mockResolvedValue([mockCategory]);

      await controller.findAll(mockReq, accountId);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.uid, accountId);
    });
  });

  describe('findOne', () => {
    it('should return a single category', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockCategory);

      const result = await controller.findOne(mockReq, 'test-id');

      expect(service.findOne).toHaveBeenCalledWith('test-id', mockUser.uid);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const createCategoryDto = {
        name: 'New Category',
        color: '#4CAF50',
        icon: 'restaurant',
        account_id: 'test-account-id',
      };

      jest.spyOn(service, 'create').mockResolvedValue(mockCategory);

      const result = await controller.create(mockReq, createCategoryDto);

      expect(service.create).toHaveBeenCalledWith(mockUser.uid, createCategoryDto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const updateCategoryDto = {
        name: 'Updated Category',
        color: '#2196F3',
      };

      jest.spyOn(service, 'update').mockResolvedValue(mockCategory);

      const result = await controller.update(mockReq, 'test-id', updateCategoryDto);

      expect(service.update).toHaveBeenCalledWith('test-id', mockUser.uid, updateCategoryDto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('remove', () => {
    it('should remove a category', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      await controller.remove(mockReq, 'test-id');

      expect(service.remove).toHaveBeenCalledWith('test-id', mockUser.uid);
    });
  });
});