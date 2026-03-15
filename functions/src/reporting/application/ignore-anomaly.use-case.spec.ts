import { Test, TestingModule } from '@nestjs/testing';
import { IgnoreAnomalyUseCase } from './ignore-anomaly.use-case';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';

describe('IgnoreAnomalyUseCase', () => {
  let useCase: IgnoreAnomalyUseCase;
  let transactionRepository: jest.Mocked<TransactionRepository>;

  const mockTransactionRepository = {
    findById: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IgnoreAnomalyUseCase,
        {
          provide: TransactionRepository,
          useValue: mockTransactionRepository,
        },
      ],
    }).compile();

    useCase = module.get<IgnoreAnomalyUseCase>(IgnoreAnomalyUseCase);
    transactionRepository = module.get(TransactionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should add anomaly type to transaction metadata', async () => {
    const accountId = 'acc-1';
    const transactionId = 'tx-1';
    const anomalyType = 'outlier';

    const existingTx = Transaction.create({
      id: transactionId,
      accountId,
      categoryId: 'cat-1',
      date: new Date(),
      description: 'Big expense',
      amount: BigInt(-100000),
      metadata: { original: 'data' },
    });

    transactionRepository.findById.mockResolvedValue(existingTx);

    await useCase.execute(accountId, [transactionId], anomalyType);

    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: transactionId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: expect.objectContaining({
          original: 'data',
          ignoredAnomalies: [anomalyType],
        }),
      }),
    );
  });

  it('should not update if transaction belongs to another account', async () => {
    const accountId = 'acc-1';
    const transactionId = 'tx-1';

    const existingTx = Transaction.create({
      id: transactionId,
      accountId: 'other-acc',
      categoryId: 'cat-1',
      date: new Date(),
      description: 'Big expense',
      amount: BigInt(-100000),
    });

    transactionRepository.findById.mockResolvedValue(existingTx);

    await useCase.execute(accountId, [transactionId], 'outlier');

    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('should handle multiple transactions', async () => {
    const accountId = 'acc-1';
    const txIds = ['tx-1', 'tx-2'];

    transactionRepository.findById.mockImplementation((id) =>
      Promise.resolve(
        Transaction.create({
          id,
          accountId,
          categoryId: 'cat-1',
          date: new Date(),
          description: 'Desc',
          amount: BigInt(-1000),
        }),
      ),
    );

    await useCase.execute(accountId, txIds, 'duplicate');

    expect(transactionRepository.save).toHaveBeenCalledTimes(2);
  });
});
