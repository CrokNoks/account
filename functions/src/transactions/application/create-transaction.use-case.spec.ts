import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateTransactionUseCase,
  CreateTransactionCommand,
} from './create-transaction.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { ApplyPeriodSwitchService } from '../../periods/application/apply-period-switch.service';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { DomainValidationError } from '../../shared/domain/errors';

describe('CreateTransactionUseCase', () => {
  let useCase: CreateTransactionUseCase;
  let repository: jest.Mocked<TransactionRepository>;
  let refs: { ensureReferences: jest.Mock };
  let periodSwitch: { process: jest.Mock };

  beforeEach(async () => {
    periodSwitch = {
      process: jest.fn((request: { transactions: unknown[] }) =>
        Promise.resolve({
          transactions: request.transactions,
          written: false,
          periodSwitch: null,
        }),
      ),
    };
    refs = { ensureReferences: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTransactionUseCase,
        { provide: AccountReferencesService, useValue: refs },
        { provide: ApplyPeriodSwitchService, useValue: periodSwitch },
        {
          provide: TransactionRepository,
          useValue: {
            save: jest.fn((t: unknown) => Promise.resolve(t)),
          },
        },
      ],
    }).compile();

    useCase = module.get<CreateTransactionUseCase>(CreateTransactionUseCase);
    repository = module.get<TransactionRepository>(
      TransactionRepository,
    ) as jest.Mocked<TransactionRepository>;
  });

  it('should create and save a new transaction', async () => {
    const command: CreateTransactionCommand = {
      accountId: 'acc-1',
      categoryId: 'cat-1',
      date: new Date(),
      description: 'Coffee',
      amount: BigInt(-350),
    };

    const { transaction: result, periodSwitch: info } =
      await useCase.execute(command);

    expect(result.id).toBeDefined();
    expect(result.description).toBe('Coffee');
    expect(info).toBeNull();
    expect(repository.save).toHaveBeenCalled();
  });

  it('P1 : refuses a transaction both reconciled and pending, writes nothing', async () => {
    await expect(
      useCase.execute({
        accountId: 'acc-1',
        categoryId: null,
        date: new Date(),
        description: 'Facture',
        amount: BigInt(-9000),
        reconciled: true,
        pending: true,
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(repository.save).not.toHaveBeenCalled();
    expect(periodSwitch.process).not.toHaveBeenCalled();
  });

  it('P2 : accepts a pending transaction that is not reconciled (facture, récurrente)', async () => {
    const { transaction } = await useCase.execute({
      accountId: 'acc-1',
      categoryId: null,
      date: new Date(),
      description: 'Facture',
      amount: BigInt(-9000),
      pending: true,
    });

    expect(transaction).toMatchObject({ pending: true, reconciled: false });
  });

  it('refuses references of another account without saving', async () => {
    refs.ensureReferences.mockRejectedValue(
      new DomainValidationError('Category does not belong to this account'),
    );

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        categoryId: 'cat-foreign',
        tagIds: ['tag-foreign'],
        date: new Date(),
        description: 'Coffee',
        amount: BigInt(-350),
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(refs.ensureReferences).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({
        categoryId: 'cat-foreign',
        tagIds: ['tag-foreign'],
      }),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('lets the period switch service write the transaction atomically and does not save it a second time', async () => {
    const info = {
      closed: { id: 'p1', startDate: '2026-10-01', endDate: '2026-11-27' },
      opened: { id: 'p2', startDate: '2026-11-28', endDate: '2026-12-27' },
      count: 1,
      dateChanged: false,
    };
    periodSwitch.process.mockImplementation(
      (request: { transactions: unknown[] }) =>
        Promise.resolve({
          transactions: request.transactions,
          written: true,
          periodSwitch: info,
        }),
    );

    const result = await useCase.execute({
      accountId: 'acc-1',
      categoryId: 'cat-salary',
      date: new Date('2026-11-28'),
      description: 'Paie',
      amount: BigInt(200000),
    });

    expect(periodSwitch.process).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-1', mode: 'create' }),
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(result.periodSwitch).toBe(info);
  });

  it('does not save separately when the atomic switch fails', async () => {
    periodSwitch.process.mockRejectedValue(new Error('overlap'));

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        categoryId: 'cat-salary',
        date: new Date('2026-11-28'),
        description: 'Paie',
        amount: BigInt(200000),
      }),
    ).rejects.toThrow('overlap');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
