import { Test, TestingModule } from '@nestjs/testing';
import { PaymentMethodsController } from '../payment-methods.controller';
import { PaymentMethodsService } from '../payment-methods.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('PaymentMethodsController', () => {
  let controller: PaymentMethodsController;
  let service: PaymentMethodsService;

  const mockPaymentMethod = {
    id: 'test-id',
    name: 'Credit Card',
    type: 'credit_card',
    provider: 'visa',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  // Note: PaymentMethods don't require user context as they are global resources

  beforeEach(async () => {
    const mockPaymentMethodsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentMethodsController],
      providers: [
        {
          provide: PaymentMethodsService,
          useValue: mockPaymentMethodsService,
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentMethodsController>(PaymentMethodsController);
    service = module.get<PaymentMethodsService>(PaymentMethodsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of payment methods', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([mockPaymentMethod]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockPaymentMethod]);
    });
  });

  describe('findOne', () => {
    it('should return a single payment method', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPaymentMethod);

      const result = await controller.findOne('test-id');

      expect(service.findOne).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockPaymentMethod);
    });
  });

  describe('create', () => {
    it('should create a new payment method', async () => {
      const createPaymentMethodDto = {
        name: 'PayPal',
        type: 'online',
        provider: 'paypal',
      };

      jest.spyOn(service, 'create').mockResolvedValue(mockPaymentMethod);

      const result = await controller.create(createPaymentMethodDto);

      expect(service.create).toHaveBeenCalledWith(createPaymentMethodDto);
      expect(result).toEqual(mockPaymentMethod);
    });
  });

  describe('update', () => {
    it('should update a payment method', async () => {
      const updatePaymentMethodDto = {
        name: 'Updated Payment Method',
        provider: 'mastercard',
      };

      jest.spyOn(service, 'update').mockResolvedValue(mockPaymentMethod);

      const result = await controller.update('test-id', updatePaymentMethodDto);

      expect(service.update).toHaveBeenCalledWith('test-id', updatePaymentMethodDto);
      expect(result).toEqual(mockPaymentMethod);
    });
  });

  describe('remove', () => {
    it('should remove a payment method', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      await controller.remove('test-id');

      expect(service.remove).toHaveBeenCalledWith('test-id');
    });
  });
});