import { Logger } from '@nestjs/common';
import { GetSpendingPaceUseCase } from './get-spending-pace.use-case';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { Account } from '../../accounts/domain/account.entity';
import { Period } from '../../periods/domain/period.entity';
import {
  Category,
  CategoryType,
} from '../../categories/domain/category.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';

const category = (id: string, type: CategoryType) =>
  new Category({
    id,
    name: id,
    color: '#000000',
    type,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
const period = (
  id: string,
  start: string,
  end: string | null,
  isActive = false,
  accountId = 'acc-1',
) =>
  Period.create({
    id,
    accountId,
    startDate: new Date(start),
    endDate: end ? new Date(end) : null,
    isActive,
  });
const tx = (amount: number, categoryId: string | null, date: string) =>
  Transaction.create({
    accountId: 'acc-1',
    categoryId,
    date: new Date(date),
    description: 'secret libellé',
    amount: BigInt(amount),
    reconciled: false,
    pending: false,
  });

describe('GetSpendingPaceUseCase', () => {
  const nov = period('nov', '2026-11-01', '2026-11-30', true);
  const oct = period('oct', '2026-10-01', '2026-10-31');
  const sep = period('sep', '2026-09-01', '2026-09-30');
  const aug = period('aug', '2026-08-01', '2026-08-31');
  const dec = period('dec', '2026-12-01', '2026-12-31', true);
  const today = new Date('2026-11-10');

  let periodsList: Period[];
  let txByStart: Record<string, Transaction[]>;
  let accounts: { findById: jest.Mock };
  let periods: { findById: jest.Mock; findAllByAccount: jest.Mock };
  let transactions: { findAllByAccountUnpaginated: jest.Mock };
  let categories: { findAllByAccount: jest.Mock };
  let useCase: GetSpendingPaceUseCase;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    periodsList = [nov, oct, sep, aug, dec];
    txByStart = {};
    accounts = {
      findById: jest.fn().mockResolvedValue(
        new Account({
          id: 'acc-1',
          name: 'Courant',
          ownerId: 'u-1',
          initialBalance: BigInt(0),
        }),
      ),
    };
    periods = {
      findById: jest.fn((id: string) =>
        Promise.resolve(periodsList.find((p) => p.id === id)),
      ),
      findAllByAccount: jest.fn(() => Promise.resolve(periodsList)),
    };
    transactions = {
      findAllByAccountUnpaginated: jest.fn(
        (_acc: string, o: { startDate: Date }) =>
          Promise.resolve(
            txByStart[o.startDate.toISOString().slice(0, 10)] ?? [],
          ),
      ),
    };
    categories = {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([
          category('dep', CategoryType.EXPENSE),
          category('rev', CategoryType.INCOME),
        ]),
    };
    useCase = new GetSpendingPaceUseCase(
      accounts as unknown as AccountRepository,
      periods as unknown as PeriodRepository,
      transactions as unknown as TransactionRepository,
      categories as unknown as CategoryRepository,
    );
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });
  afterEach(() => logSpy.mockRestore());

  it('période active : courbe jusqu’à aujourd’hui, précédente = octobre', async () => {
    txByStart['2026-11-01'] = [
      tx(-1500, 'dep', '2026-11-03'),
      tx(-999, 'dep', '2026-11-15'),
    ];
    txByStart['2026-10-01'] = [
      tx(-800, 'dep', '2026-10-05'),
      tx(-1500, 'dep', '2026-10-20'),
    ];

    const r = await useCase.execute('acc-1', 'nov', today);

    expect(r.previousPeriodId).toBe('oct');
    expect(r.points).toHaveLength(10);
    expect(r.points[9]).toEqual({
      day: 10,
      date: '2026-11-10',
      cumulative: '1500',
      previousCumulative: '800',
    });
    expect(r.gap).toBe('700');
  });

  it('charge la période courante jusqu’à aujourd’hui, la précédente sur sa durée', async () => {
    await useCase.execute('acc-1', 'nov', today);

    const calls = transactions.findAllByAccountUnpaginated.mock
      .calls as unknown[][];
    expect(calls[0][1]).toEqual({
      startDate: nov.startDate,
      endDate: today,
    });
    expect(calls[1][1]).toEqual({
      startDate: oct.startDate,
      endDate: oct.endDate,
    });
  });

  it('choisit la précédente par date de début, ignore la postérieure', async () => {
    const r = await useCase.execute('acc-1', 'oct', today);
    expect(r.previousPeriodId).toBe('sep');
    const r2 = await useCase.execute('acc-1', 'nov', today);
    expect(r2.previousPeriodId).toBe('oct');
  });

  it('aucune période antérieure : pas de comparaison', async () => {
    const r = await useCase.execute('acc-1', 'aug', today);
    expect(r.previousPeriodId).toBeNull();
    expect(r.gap).toBeNull();
    expect(r.points.every((p) => p.previousCumulative === null)).toBe(true);
  });

  it('période fermée : longueur complète, indépendante de today', async () => {
    const r = await useCase.execute('acc-1', 'oct', new Date('2027-05-01'));
    expect(r.points).toHaveLength(31);
  });

  it('période fermée plus longue que la précédente : la précédente garde son cumul final', async () => {
    periodsList = [
      period('mar', '2026-03-01', '2026-03-31'),
      period('feb', '2026-02-01', '2026-02-28'),
    ];
    txByStart['2026-02-01'] = [tx(-500, 'dep', '2026-02-02')];

    const r = await useCase.execute('acc-1', 'mar', today);

    expect(r.points).toHaveLength(31);
    expect(r.points[30].previousCumulative).toBe('500');
    expect(r.points[29].previousCumulative).toBe('500');
  });

  it('précédente plus longue : lue jusqu’au dernier jour de la courante seulement', async () => {
    txByStart['2026-10-01'] = [tx(-1500, 'dep', '2026-10-20')];
    const r = await useCase.execute('acc-1', 'nov', today);
    expect(r.points[9].previousCumulative).toBe('0');
  });

  it('période active sans fin : jusqu’à aujourd’hui', async () => {
    periodsList = [period('open', '2026-11-01', null, true), oct];
    const r = await useCase.execute('acc-1', 'open', today);
    expect(r.points).toHaveLength(10);
  });

  it('précédente sans fin, non active : bornée à la veille du début courant', async () => {
    periodsList = [nov, period('old', '2026-10-01', null)];
    await useCase.execute('acc-1', 'nov', today);
    expect(
      (
        transactions.findAllByAccountUnpaginated.mock.calls as unknown[][]
      )[1][1],
    ).toEqual({
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-31'),
    });
  });

  it('période démarrant aujourd’hui : 1 point', async () => {
    const r = await useCase.execute('acc-1', 'nov', new Date('2026-11-01'));
    expect(r.points).toHaveLength(1);
  });

  it('période future : aucun point, écart null, rien chargé pour la courante', async () => {
    const r = await useCase.execute('acc-1', 'dec', today);
    expect(r.points).toEqual([]);
    expect(r.gap).toBeNull();
  });

  it('période future non active : aucun point, écart null, aucune transaction chargée pour elle', async () => {
    const futureClosed = period('jan', '2027-01-01', '2027-01-31', false);
    periodsList = [nov, oct, futureClosed];
    const r = await useCase.execute('acc-1', 'jan', today);
    expect(r.points).toEqual([]);
    expect(r.gap).toBeNull();
    const starts = transactions.findAllByAccountUnpaginated.mock.calls.map(
      (c: [string, { startDate: Date }]) =>
        c[1].startDate.toISOString().slice(0, 10),
    );
    expect(starts).not.toContain('2027-01-01');
  });

  it('rejette une période d’un autre compte ou inconnue', async () => {
    periodsList = [period('x', '2026-11-01', null, true, 'acc-other')];
    await expect(useCase.execute('acc-1', 'x', today)).rejects.toThrow(
      'Account or Period not found',
    );
    await expect(useCase.execute('acc-1', 'nope', today)).rejects.toThrow(
      'Account or Period not found',
    );
  });

  it('trace spending_pace_built sans montant ni libellé', async () => {
    txByStart['2026-11-01'] = [tx(-1500, 'dep', '2026-11-03')];

    await useCase.execute('acc-1', 'nov', today);

    expect(logSpy).toHaveBeenCalledWith({
      event: 'spending_pace_built',
      accountId: 'acc-1',
      periodId: 'nov',
      dayCount: 10,
      hasPrevious: true,
    });
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('secret');
  });
});
