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
    jest.useFakeTimers().setSystemTime(new Date('2026-04-28T08:00:00Z'));
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
        tx('courant', -20000, new Date('2026-01-15')), // hors fenêtre
        tx('courant', 250000, new Date('2026-04-01')), // dans les 30 jours
        tx('courant', -50000, new Date('2026-04-20')), // dans les 30 jours
      ],
      livret: [tx('livret', 10000, new Date('2026-02-01'))],
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

  it('builds the real end-of-day balance of each of the 31 days', async () => {
    const { history } = await useCase.execute();
    const at = (date: string) => history.find((p) => p.date === date)?.amount;

    expect(at('2026-03-29')).toBe('590000');
    expect(at('2026-03-31')).toBe('590000');
    expect(at('2026-04-01')).toBe('840000'); // +250000
    expect(at('2026-04-19')).toBe('840000');
    expect(at('2026-04-20')).toBe('790000'); // -50000
    expect(at('2026-04-28')).toBe('790000');
  });

  it('ends the history on the current total', async () => {
    const { history, currentTotal } = await useCase.execute();

    expect(history.at(-1)?.amount).toBe(currentTotal);
  });

  it('counts a transaction made later today but not one dated tomorrow', async () => {
    transactions.findAllByAccountUnpaginated.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'courant'
          ? [
              tx('courant', -1000, new Date('2026-04-28')),
              tx('courant', -5000, new Date('2026-04-29')),
            ]
          : [],
      ),
    );

    const { currentTotal, history } = await useCase.execute();

    expect(currentTotal).toBe('599000');
    expect(history.at(-1)?.amount).toBe('599000');
  });

  it('counts a transaction dated today just after midnight in the business time zone', async () => {
    jest.setSystemTime(new Date('2026-10-31T23:30:00Z')); // 1er nov. à Paris
    transactions.findAllByAccountUnpaginated.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'courant' ? [tx('courant', -1000, new Date('2026-11-01'))] : [],
      ),
    );

    const { currentTotal, history } = await useCase.execute();

    expect(history.at(-1)?.date).toBe('2026-11-01');
    expect(currentTotal).toBe('599000');
  });

  it('loads the transactions only once per account', async () => {
    await useCase.execute();

    expect(transactions.findAllByAccountUnpaginated).toHaveBeenCalledTimes(2);
  });

  it('excludes future-dated transactions from the current total', async () => {
    transactions.findAllByAccountUnpaginated.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'courant' ? [tx('courant', -1000, new Date('2026-06-01'))] : [],
      ),
    );

    expect((await useCase.execute()).currentTotal).toBe('600000');
  });
});
