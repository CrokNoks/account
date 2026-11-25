import { Logger } from '@nestjs/common';
import { ApplyPeriodSwitchService } from './apply-period-switch.service';
import {
  Category,
  CategoryType,
} from '../../categories/domain/category.entity';
import { RecurringTransaction } from '../../recurring/domain/recurring-transaction.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { Period } from '../domain/period.entity';
import { PeriodSwitchWrite } from '../domain/period.repository.interface';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

const ACC = 'acc-1';
const SALARY = 'cat-salary';
const BILLS = 'cat-bills';

describe('ApplyPeriodSwitchService', () => {
  let categories: { findAllByAccount: jest.Mock };
  let periods: { findAllByAccount: jest.Mock; applyPeriodSwitches: jest.Mock };
  let recurring: { findAllByAccount: jest.Mock };
  let budgets: { findTemplatesByAccount: jest.Mock };
  let transactions: { findAllByAccountUnpaginated: jest.Mock };
  let service: ApplyPeriodSwitchService;
  let log: jest.SpyInstance;

  const category = (id: string, isPeriodTrigger: boolean) =>
    Category.create({
      id,
      name: id,
      color: '#112233',
      type: CategoryType.INCOME,
      accountId: ACC,
      isPeriodTrigger,
    });
  const active = (start: string) =>
    Period.create({
      id: 'p-active',
      accountId: ACC,
      startDate: d(start),
      endDate: null,
      isActive: true,
    });
  const tx = (id: string, extra: Partial<Transaction> = {}) =>
    Transaction.create({
      id,
      accountId: ACC,
      categoryId: SALARY,
      date: d('2026-11-28'),
      description: 'Paie',
      amount: 200000n,
      reconciled: false,
      pending: false,
      ...extra,
    });
  const salaryRecurring = RecurringTransaction.create({
    id: 'rec-salary',
    accountId: ACC,
    categoryId: SALARY,
    description: 'Paie',
    amount: 200000n,
    dayOfMonth: 28,
  });

  const lastWrite = () =>
    periods.applyPeriodSwitches.mock.calls[0] as [
      string,
      string,
      PeriodSwitchWrite[],
      Transaction[],
      Transaction[],
      string[],
      boolean,
    ];
  /** Les transactions écrites à titre de générées (récurrentes injectées, prochaine paie). */
  const generatedWrite = () => lastWrite()[4];

  beforeEach(() => {
    // 1er déc. 2026 (fuseau métier)
    jest.useFakeTimers({ now: new Date('2026-12-01T10:00:00Z') });
    categories = {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([category(SALARY, true), category(BILLS, false)]),
    };
    periods = {
      findAllByAccount: jest.fn().mockResolvedValue([active('2026-10-28')]),
      applyPeriodSwitches: jest
        .fn()
        .mockResolvedValue({ switched: true, removed: 0 }),
    };
    recurring = { findAllByAccount: jest.fn().mockResolvedValue([]) };
    budgets = {
      findTemplatesByAccount: jest.fn().mockResolvedValue([
        { categoryId: BILLS, amount: -30000n },
        { categoryId: 'cat-zero', amount: 0n },
      ]),
    };
    transactions = {
      findAllByAccountUnpaginated: jest
        .fn()
        .mockImplementation((_acc: string, options?: { ids?: string[] }) =>
          Promise.resolve(
            options?.ids
              ? lastWrite()[3].filter((t) => options.ids!.includes(t.id))
              : [],
          ),
        ),
    };
    service = new ApplyPeriodSwitchService(
      categories as never,
      periods as never,
      recurring as never,
      budgets as never,
      transactions as never,
    );
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    log.mockRestore();
  });

  it('does nothing and reads nothing else when no category is a trigger (default setting)', async () => {
    categories.findAllByAccount.mockResolvedValue([category(SALARY, false)]);
    const input = [tx('t1')];

    const result = await service.process({
      accountId: ACC,
      mode: 'create',
      transactions: input,
    });

    expect(result).toEqual({
      transactions: input,
      written: false,
      periodSwitch: null,
    });
    expect(periods.findAllByAccount).not.toHaveBeenCalled();
    expect(periods.applyPeriodSwitches).not.toHaveBeenCalled();
  });

  it('switches on a salary created today or in the past: one atomic call with closure, opening, default budgets and the transaction', async () => {
    const salary = tx('t1', { date: d('2026-11-28') });

    const result = await service.process({
      accountId: ACC,
      mode: 'create',
      transactions: [salary],
    });

    const [accountId, expectedActive, switches, written] = lastWrite();
    expect(accountId).toBe(ACC);
    expect(expectedActive).toBe('p-active');
    expect(switches).toHaveLength(1);
    expect(iso(switches[0].closeEnd)).toBe('2026-11-27');
    expect(switches[0].closedId).toBe('p-active');
    expect(iso(switches[0].opened.startDate)).toBe('2026-11-28');
    expect(iso(switches[0].opened.endDate!)).toBe('2026-12-27');
    // montants par défaut du compte, un montant à 0 n'est pas écrit
    expect(
      switches[0].budgets.map((b) => [b.categoryId, b.amountAllocated]),
    ).toEqual([[BILLS, -30000n]]);
    expect(written.find((t) => t.id === 't1')?.periodId).toBe(
      switches[0].opened.id,
    );
    expect(result.written).toBe(true);
    expect(result.periodSwitch).toMatchObject({
      closed: { endDate: '2026-11-27' },
      opened: { startDate: '2026-11-28' },
      count: 1,
      dateChanged: false,
    });
  });

  it('logs period_opened with origin trigger and no label or amount', async () => {
    await service.process({
      accountId: ACC,
      mode: 'create',
      transactions: [tx('t1')],
    });

    const event = log.mock.calls
      .map(([entry]) => entry as Record<string, unknown>)
      .find((e) => e.event === 'period_opened');
    expect(event).toMatchObject({
      event: 'period_opened',
      origin: 'trigger',
      accountId: ACC,
      start: '2026-11-28',
    });
    expect(event).not.toHaveProperty('description');
    expect(event).not.toHaveProperty('amount');
    expect(JSON.stringify(event)).not.toContain('200000');
  });

  it.each([
    ['pending', { pending: true }, 'pending'],
    ['dated in the future', { date: d('2026-12-02') }, 'future'],
    ['dated before the start', { date: d('2026-10-20') }, 'threshold'],
    ['of another category', { categoryId: BILLS }, null],
  ] as const)(
    'creating a transaction %s: no switch, plain save, reason logged',
    async (_label, extra, reason) => {
      const input = [tx('t1', extra)];

      const result = await service.process({
        accountId: ACC,
        mode: 'create',
        transactions: input,
      });

      expect(result).toEqual({
        transactions: input,
        written: false,
        periodSwitch: null,
      });
      expect(periods.applyPeriodSwitches).not.toHaveBeenCalled();
      const skipped = log.mock.calls
        .map(([entry]) => entry as Record<string, unknown>)
        .filter((e) => e.event === 'period_trigger_skipped');
      expect(skipped.map((e) => e.reason)).toEqual(reason ? [reason] : []);
    },
  );

  it('with no active period: no switch, reason no_active', async () => {
    periods.findAllByAccount.mockResolvedValue([]);

    const result = await service.process({
      accountId: ACC,
      mode: 'create',
      transactions: [tx('t1')],
    });

    expect(result.written).toBe(false);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'period_trigger_skipped',
        reason: 'no_active',
      }),
    );
  });

  describe('leaving pending', () => {
    it('salary planned 28 Nov taken out 1 Dec: date becomes today, closes 30 Nov, opens 1 Dec to 27 Dec, next salary 28 Dec pending once', async () => {
      recurring.findAllByAccount.mockResolvedValue([salaryRecurring]);
      const pendingSalary = tx('t1', {
        date: d('2026-11-28'),
        pending: false,
        metadata: { recurringId: 'rec-salary' },
      });
      transactions.findAllByAccountUnpaginated.mockImplementation(
        (_a: string, options?: { ids?: string[]; startDate?: Date }) =>
          Promise.resolve(
            options?.ids
              ? lastWrite()[3].filter((t) => options.ids!.includes(t.id))
              : [
                  // la paie qu'on sort, encore datée du 28 nov. en base
                  tx('t1', {
                    pending: true,
                    metadata: { recurringId: 'rec-salary' },
                  }),
                ],
          ),
      );

      const result = await service.process({
        accountId: ACC,
        mode: 'update',
        transactions: [pendingSalary],
        leavingPendingIds: new Set(['t1']),
      });

      const [, , switches, written, generated] = lastWrite();
      expect(iso(switches[0].closeEnd)).toBe('2026-11-30');
      expect(iso(switches[0].opened.startDate)).toBe('2026-12-01');
      expect(iso(switches[0].opened.endDate!)).toBe('2026-12-27');
      expect(iso(written.find((t) => t.id === 't1')!.date)).toBe('2026-12-01');
      const next = generated.filter(
        (t) =>
          t.pending &&
          (t.metadata as { recurringId?: string }).recurringId === 'rec-salary',
      );
      expect(next.map((t) => iso(t.date))).toEqual(['2026-12-28']);
      expect(result.periodSwitch?.dateChanged).toBe(true);
    });

    it('two pending salaries leaving together: the other one is read in its final state, so the next salary is still created once', async () => {
      recurring.findAllByAccount.mockResolvedValue([salaryRecurring]);
      const stored = (id: string, date: string) =>
        tx(id, {
          date: d(date),
          pending: true,
          metadata: { recurringId: 'rec-salary' },
        });
      transactions.findAllByAccountUnpaginated.mockImplementation(
        (_a: string, options?: { ids?: string[] }) =>
          Promise.resolve(
            options?.ids
              ? lastWrite()[3].filter((t) => options.ids!.includes(t.id))
              : [stored('t1', '2026-11-28'), stored('t2', '2026-12-28')],
          ),
      );
      const leaving = (id: string, date: string) =>
        tx(id, {
          date: d(date),
          pending: false,
          metadata: { recurringId: 'rec-salary' },
        });

      await service.process({
        accountId: ACC,
        mode: 'update',
        transactions: [
          leaving('t1', '2026-11-28'),
          leaving('t2', '2026-12-28'),
        ],
        leavingPendingIds: new Set(['t1', 't2']),
      });

      const next = generatedWrite().filter(
        (t) =>
          t.pending &&
          (t.metadata as { recurringId?: string }).recurringId === 'rec-salary',
      );
      expect(next.map((t) => iso(t.date))).toEqual(['2026-12-28']);
    });

    it('update mode: only the salary taken out gets the new period, other lines of the batch keep theirs', async () => {
      const result = await service.process({
        accountId: ACC,
        mode: 'update',
        transactions: [
          tx('t1'),
          tx('b1', {
            categoryId: BILLS,
            date: d('2026-12-05'),
            periodId: 'p-other',
          }),
          tx('b2', { categoryId: BILLS, date: d('2026-12-06') }),
        ],
        leavingPendingIds: new Set(['t1']),
      });

      const [, , switches, written] = lastWrite();
      const opened = switches[0].opened.id;
      expect(written.find((t) => t.id === 't1')!.periodId).toBe(opened);
      expect(written.find((t) => t.id === 'b1')!.periodId).toBe('p-other');
      expect(written.find((t) => t.id === 'b2')!.periodId).toBeUndefined();
      expect(result.periodSwitch).not.toBeNull();
    });

    it('tells the base which mode it is: rows must exist in update mode, new in create mode', async () => {
      await service.process({
        accountId: ACC,
        mode: 'update',
        transactions: [tx('t1')],
        leavingPendingIds: new Set(['t1']),
      });
      expect(lastWrite()[6]).toBe(true);

      periods.applyPeriodSwitches.mockClear();
      await service.process({
        accountId: ACC,
        mode: 'create',
        transactions: [tx('t2')],
      });
      expect(lastWrite()[6]).toBe(false);
    });

    it('salary planned in the future taken out today: date is today and it switches', async () => {
      const result = await service.process({
        accountId: ACC,
        mode: 'update',
        transactions: [tx('t1', { date: d('2026-12-20') })],
        leavingPendingIds: new Set(['t1']),
      });

      const [, , switches, written] = lastWrite();
      expect(iso(written.find((t) => t.id === 't1')!.date)).toBe('2026-12-01');
      expect(iso(switches[0].opened.startDate)).toBe('2026-12-01');
      expect(result.periodSwitch).not.toBeNull();
    });

    it('under the threshold: no switch but the date still becomes today', async () => {
      periods.findAllByAccount.mockResolvedValue([active('2026-11-20')]);

      const result = await service.process({
        accountId: ACC,
        mode: 'update',
        transactions: [tx('t1', { date: d('2026-11-28') })],
        leavingPendingIds: new Set(['t1']),
      });

      expect(result.written).toBe(false);
      expect(result.periodSwitch).toBeNull();
      expect(iso(result.transactions[0].date)).toBe('2026-12-01');
      expect(periods.applyPeriodSwitches).not.toHaveBeenCalled();
    });

    it('a bill (not the trigger category) leaving pending keeps its date and never switches', async () => {
      const bill = tx('t1', { categoryId: BILLS, date: d('2026-11-28') });

      const result = await service.process({
        accountId: ACC,
        mode: 'update',
        transactions: [bill],
        leavingPendingIds: new Set(['t1']),
      });

      expect(result.transactions[0]).toBe(bill);
      expect(iso(result.transactions[0].date)).toBe('2026-11-28');
      expect(result.written).toBe(false);
      expect(periods.findAllByAccount).not.toHaveBeenCalled();
    });

    it('an update that does not leave pending (e.g. category only) never switches', async () => {
      const result = await service.process({
        accountId: ACC,
        mode: 'update',
        transactions: [tx('t1')],
        leavingPendingIds: new Set(),
      });

      expect(result.written).toBe(false);
      expect(periods.findAllByAccount).not.toHaveBeenCalled();
      expect(periods.applyPeriodSwitches).not.toHaveBeenCalled();
    });

    it('a batch of two salaries leaving pending: both take today, a single switch', async () => {
      const result = await service.process({
        accountId: ACC,
        mode: 'update',
        transactions: [
          tx('t1', { date: d('2026-11-28') }),
          tx('t2', { date: d('2026-12-20') }),
          tx('t3', { categoryId: BILLS, date: d('2026-11-15') }),
        ],
        leavingPendingIds: new Set(['t1', 't2', 't3']),
      });

      const [, , switches, written] = lastWrite();
      expect(switches).toHaveLength(1);
      expect(iso(written.find((t) => t.id === 't1')!.date)).toBe('2026-12-01');
      expect(iso(written.find((t) => t.id === 't2')!.date)).toBe('2026-12-01');
      expect(iso(written.find((t) => t.id === 't3')!.date)).toBe('2026-11-15');
      expect(result.periodSwitch?.count).toBe(1);
    });
  });

  describe('import (several salaries)', () => {
    it('chains the switches in date order in one atomic call, each line in the period containing its date', async () => {
      periods.findAllByAccount.mockResolvedValue([active('2026-08-28')]);
      recurring.findAllByAccount.mockResolvedValue([salaryRecurring]);

      const result = await service.process({
        accountId: ACC,
        mode: 'create',
        transactions: [
          tx('t3', { date: d('2026-11-28') }),
          tx('t1', { date: d('2026-09-28') }),
          tx('t2', { date: d('2026-10-28') }),
        ],
      });

      expect(periods.applyPeriodSwitches).toHaveBeenCalledTimes(1);
      const [, , switches, written, generated] = lastWrite();
      expect(switches.map((s) => iso(s.opened.startDate))).toEqual([
        '2026-09-28',
        '2026-10-28',
        '2026-11-28',
      ]);
      const periodOf = (id: string) =>
        written.find((t) => t.id === id)?.periodId;
      expect(periodOf('t1')).toBe(switches[0].opened.id);
      expect(periodOf('t2')).toBe(switches[1].opened.id);
      expect(periodOf('t3')).toBe(switches[2].opened.id);
      expect(result.periodSwitch?.count).toBe(3);
      // seule la dernière bascule crée la prochaine paie en pending
      const pendingSalaries = generated.filter(
        (t) => t.pending && t.categoryId === SALARY,
      );
      expect(pendingSalaries.map((t) => iso(t.date))).toEqual(['2026-12-28']);
    });

    it('a salary under 15 days after the first switch of the import is saved without a switch of its own', async () => {
      periods.findAllByAccount.mockResolvedValue([active('2026-08-01')]);

      await service.process({
        accountId: ACC,
        mode: 'create',
        transactions: [
          tx('t1', { date: d('2026-09-28') }),
          tx('t2', { date: d('2026-10-05') }),
        ],
      });

      expect(lastWrite()[2]).toHaveLength(1);
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'period_trigger_skipped',
          reason: 'threshold',
          transactionId: 't2',
        }),
      );
    });
  });

  describe('import : nettoyage des pending récurrentes', () => {
    const BILLS_LINE = (id: string, date: string) =>
      tx(id, {
        categoryId: BILLS,
        amount: -5000n,
        description: 'Facture secrète',
        date: d(date),
      });
    const pendingRecurring = (id: string, date: string) =>
      tx(id, {
        categoryId: BILLS,
        amount: -5000n,
        description: 'Facture secrète',
        date: d(date),
        pending: true,
        metadata: { source: 'recurring', recurringId: `rec-${id}` },
      });
    const storedList = (list: Transaction[]) =>
      transactions.findAllByAccountUnpaginated.mockImplementation(
        (_acc: string, options?: { ids?: string[] }) =>
          Promise.resolve(
            options?.ids
              ? lastWrite()[3].filter((t) => options.ids!.includes(t.id))
              : list,
          ),
      );
    const importing = (lines: Transaction[]) =>
      service.process({
        accountId: ACC,
        mode: 'create',
        cleanup: true,
        transactions: lines,
      });

    it('passes the ids to remove to the atomic write, reads pending from the start of the active period, reports and logs them', async () => {
      periods.applyPeriodSwitches.mockResolvedValue({
        switched: true,
        removed: 1,
      });
      storedList([
        pendingRecurring('old-pending', '2026-10-30'),
        pendingRecurring('kept-pending', '2026-11-20'),
      ]);

      const result = await importing([
        tx('paie', { date: d('2026-11-28') }),
        BILLS_LINE('l1', '2026-10-30'),
      ]);

      expect(lastWrite()[5]).toEqual(['old-pending']);
      expect(
        (
          transactions.findAllByAccountUnpaginated.mock.calls[0] as [
            string,
            { startDate: Date },
          ]
        )[1].startDate,
      ).toEqual(d('2026-10-28'));
      expect(result.periodSwitch).toEqual(
        expect.objectContaining({ removedPending: 1, remainingPending: 1 }),
      );
      expect(log).toHaveBeenCalledWith({
        event: 'recurring_pending_removed',
        accountId: ACC,
        transactionId: 'old-pending',
      });
    });

    it('removes nothing without switch (threshold)', async () => {
      periods.findAllByAccount.mockResolvedValue([active('2026-11-20')]);
      storedList([pendingRecurring('p1', '2026-11-21')]);

      await importing([
        tx('paie', { date: d('2026-11-28') }),
        BILLS_LINE('l1', '2026-11-21'),
      ]);

      expect(periods.applyPeriodSwitches).not.toHaveBeenCalled();
    });

    it('removes nothing for a simple entry (no cleanup flag)', async () => {
      storedList([pendingRecurring('p1', '2026-11-12')]);

      const result = await service.process({
        accountId: ACC,
        mode: 'create',
        transactions: [tx('paie', { date: d('2026-11-28') })],
      });

      expect(lastWrite()[5]).toEqual([]);
      expect(result.periodSwitch?.removedPending).toBeUndefined();
    });

    it('a lost concurrent switch removes nothing and logs no removal', async () => {
      storedList([pendingRecurring('p1', '2026-11-12')]);
      periods.applyPeriodSwitches.mockResolvedValue({
        switched: false,
        removed: 0,
      });

      const result = await importing([
        tx('paie', { date: d('2026-11-28') }),
        BILLS_LINE('l1', '2026-11-12'),
      ]);

      expect(result.periodSwitch).toBeNull();
      expect(log).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: 'recurring_pending_removed' }),
      );
    });

    it('a failed write propagates: nothing is reported removed', async () => {
      storedList([pendingRecurring('p1', '2026-11-12')]);
      periods.applyPeriodSwitches.mockRejectedValue(new Error('boom'));

      await expect(
        importing([
          tx('paie', { date: d('2026-11-28') }),
          BILLS_LINE('l1', '2026-11-12'),
        ]),
      ).rejects.toThrow('boom');
      expect(log).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: 'recurring_pending_removed' }),
      );
    });
  });

  describe('atomicity and concurrency', () => {
    it('propagates an error of the atomic write and returns nothing (nothing is saved by the caller)', async () => {
      periods.applyPeriodSwitches.mockRejectedValue(new Error('overlap'));

      await expect(
        service.process({
          accountId: ACC,
          mode: 'create',
          transactions: [tx('t1')],
        }),
      ).rejects.toThrow('overlap');
    });

    it('a lost concurrent switch: the line is already written without switch, logged concurrent', async () => {
      periods.applyPeriodSwitches.mockResolvedValue({ switched: false });

      const result = await service.process({
        accountId: ACC,
        mode: 'create',
        transactions: [tx('t1')],
      });

      expect(result.written).toBe(true);
      expect(result.periodSwitch).toBeNull();
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'period_trigger_skipped',
          reason: 'concurrent',
        }),
      );
      expect(log).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: 'period_opened' }),
      );
    });

    it('keeps the generated lines (recurring, next salary) apart from the request lines, so a lost switch cannot write them', async () => {
      const rent = RecurringTransaction.create({
        id: 'rec-rent',
        accountId: ACC,
        categoryId: BILLS,
        description: 'Loyer',
        amount: -70000n,
        dayOfMonth: 5,
      });
      recurring.findAllByAccount.mockResolvedValue([rent, salaryRecurring]);

      await service.process({
        accountId: ACC,
        mode: 'create',
        transactions: [tx('t1')],
      });

      const [, , , lines, generated] = lastWrite();
      expect(lines.map((t) => t.id)).toEqual(['t1']);
      expect(generated.length).toBeGreaterThan(0);
      expect(
        generated.map(
          (t) => (t.metadata as { recurringId?: string }).recurringId,
        ),
      ).toEqual(expect.arrayContaining(['rec-rent', 'rec-salary']));
    });

    it('passes the active period it read as the expected one (lock check done in SQL)', async () => {
      await service.process({
        accountId: ACC,
        mode: 'create',
        transactions: [tx('t1')],
      });

      expect(lastWrite()[1]).toBe('p-active');
    });
  });

  describe('récurrentes à la bascule', () => {
    it('injects the recurring of the new period once, not when already present the same month', async () => {
      const rent = RecurringTransaction.create({
        id: 'rec-rent',
        accountId: ACC,
        categoryId: BILLS,
        description: 'Loyer',
        amount: -70000n,
        dayOfMonth: 5,
      });
      recurring.findAllByAccount.mockResolvedValue([rent]);
      transactions.findAllByAccountUnpaginated.mockImplementation(
        (_a: string, options?: { ids?: string[] }) =>
          Promise.resolve(
            options?.ids
              ? lastWrite()[3].filter((t) => options.ids!.includes(t.id))
              : [],
          ),
      );

      await service.process({
        accountId: ACC,
        mode: 'create',
        transactions: [tx('t1')],
      });
      const rents = generatedWrite().filter(
        (t) =>
          (t.metadata as { recurringId?: string }).recurringId === 'rec-rent',
      );
      expect(rents.map((t) => iso(t.date))).toEqual(['2026-12-05']);
      expect(rents[0].pending).toBe(true);

      periods.applyPeriodSwitches.mockClear();
      transactions.findAllByAccountUnpaginated.mockImplementation(
        (_a: string, options?: { ids?: string[] }) =>
          Promise.resolve(
            options?.ids
              ? lastWrite()[3].filter((t) => options.ids!.includes(t.id))
              : [
                  tx('old-rent', {
                    categoryId: BILLS,
                    date: d('2026-12-02'),
                    metadata: { recurringId: 'rec-rent' },
                  }),
                ],
          ),
      );
      await service.process({
        accountId: ACC,
        mode: 'create',
        transactions: [tx('t2')],
      });
      expect(
        generatedWrite().filter(
          (t) =>
            (t.metadata as { recurringId?: string }).recurringId === 'rec-rent',
        ),
      ).toEqual([]);
    });
  });
});
