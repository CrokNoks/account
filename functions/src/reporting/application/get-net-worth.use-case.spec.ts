import { GetNetWorthUseCase } from './get-net-worth.use-case';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { Account } from '../../accounts/domain/account.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';

const tx = (accountId: string, amount: number, date: Date) =>
  Transaction.create({
    accountId,
    categoryId: null,
    date,
    description: 'tx',
    amount: BigInt(amount),
    reconciled: false,
    pending: false,
  });

describe('GetNetWorthUseCase', () => {
  let accounts: { findAllForUser: jest.Mock };
  let transactions: { findAllByAccountUnpaginated: jest.Mock };
  let useCase: GetNetWorthUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 3, 28, 10, 0, 0));
    accounts = {
      findAllForUser: jest.fn().mockResolvedValue([
        new Account({
          id: 'courant',
          name: 'Courant',
          ownerId: 'u-1',
          initialBalance: BigInt(100000),
        }),
        new Account({
          id: 'livret',
          name: 'Livret',
          ownerId: 'u-1',
          initialBalance: BigInt(500000),
        }),
      ]),
    };
    const byAccount: Record<string, Transaction[]> = {
      courant: [
        tx('courant', -20000, new Date(2026, 0, 15)), // hors fenêtre
        tx('courant', 250000, new Date(2026, 3, 1)), // dans les 30 jours
        tx('courant', -50000, new Date(2026, 3, 20)), // dans les 30 jours
      ],
      livret: [tx('livret', 10000, new Date(2026, 1, 1))],
    };
    transactions = {
      findAllByAccountUnpaginated: jest.fn((id: string) =>
        Promise.resolve(byAccount[id]),
      ),
    };
    useCase = new GetNetWorthUseCase(
      accounts as unknown as AccountRepository,
      transactions as unknown as TransactionRepository,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('returns 0 and no history when the user has no account', async () => {
    accounts.findAllForUser.mockResolvedValue([]);

    expect(await useCase.execute()).toEqual({ currentTotal: '0', history: [] });
  });

  it('sums the balance of every accessible account', async () => {
    // courant : 100000 - 20000 + 250000 - 50000 ; livret : 500000 + 10000
    expect((await useCase.execute()).currentTotal).toBe('790000');
  });

  it('returns one point per day over the last 30 days, today included', async () => {
    const { history } = await useCase.execute();

    expect(history).toHaveLength(31);
    expect(history[0].date).toBe('2026-03-29');
    expect(history.at(-1)?.date).toBe('2026-04-28');
  });

  // Comportement actuel documenté (docs/reporting.md) : l'historique est plat,
  // chaque jour vaut le patrimoine d'il y a 30 jours.
  it('repeats the net worth of 30 days ago on every day', async () => {
    const { history } = await useCase.execute();

    // 790000 - (250000 - 50000)
    expect(new Set(history.map((p) => p.amount))).toEqual(new Set(['590000']));
  });

  // Comportement actuel : les transactions datées dans le futur comptent dans le total.
  it('includes future-dated transactions in the current total', async () => {
    transactions.findAllByAccountUnpaginated.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'courant' ? [tx('courant', -1000, new Date(2026, 5, 1))] : [],
      ),
    );

    expect((await useCase.execute()).currentTotal).toBe('599000');
  });
});
