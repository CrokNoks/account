import {
  ExistingRecurringTx,
  ImportedLine,
  PlanInput,
  SwitchRecurring,
  SwitchTrigger,
  periodIdOnDate,
  planPeriodSwitches,
} from './period-switch';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

const SALARY = 'cat-salary';
const RENT = 'cat-rent';

const salary = (day: number, id = 'rec-salary', amount = 200000n) =>
  ({
    id,
    categoryId: SALARY,
    description: 'Paie',
    amount,
    dayOfMonth: day,
  }) satisfies SwitchRecurring;
const rent: SwitchRecurring = {
  id: 'rec-rent',
  categoryId: RENT,
  description: 'Loyer',
  amount: -70000n,
  dayOfMonth: 5,
};

const trigger = (date: string, extra: Partial<SwitchTrigger> = {}) =>
  ({
    id: 'tx-1',
    date: d(date),
    pending: false,
    categoryId: SALARY,
    ...extra,
  }) satisfies SwitchTrigger;

let seq = 0;
const plan = (input: Partial<PlanInput> & { triggers: SwitchTrigger[] }) =>
  planPeriodSwitches({
    triggerCategoryId: SALARY,
    active: { id: 'p-active', start: d('2026-10-01') },
    today: d('2026-12-15'),
    recurring: [],
    existing: [],
    newId: () => `p-new-${++seq}`,
    ...input,
  });

describe('planPeriodSwitches', () => {
  beforeEach(() => {
    seq = 0;
  });

  describe('cases without switch (reason logged, nothing else)', () => {
    it('does not switch a period started less than 15 days earlier (9 days)', () => {
      const result = plan({
        active: { id: 'p-active', start: d('2026-11-01') },
        triggers: [trigger('2026-11-10')],
      });
      expect(result.switches).toEqual([]);
      expect(result.skipped).toEqual([
        { triggerId: 'tx-1', reason: 'threshold', gapDays: 9 },
      ]);
    });

    it('switches at exactly 15 days and not at 14', () => {
      const at = (date: string) =>
        plan({
          active: { id: 'p-active', start: d('2026-11-01') },
          triggers: [trigger(date)],
        });
      expect(at('2026-11-15').switches).toHaveLength(0);
      expect(at('2026-11-15').skipped[0].reason).toBe('threshold');
      expect(at('2026-11-16').switches).toHaveLength(1);
    });

    it('treats a date equal to or before the start of the active period as under the threshold', () => {
      const same = plan({
        active: { id: 'p-active', start: d('2026-11-01') },
        triggers: [trigger('2026-11-01')],
      });
      const before = plan({
        active: { id: 'p-active', start: d('2026-11-01') },
        triggers: [trigger('2026-10-20')],
      });
      expect(same.skipped[0]).toMatchObject({
        reason: 'threshold',
        gapDays: 0,
      });
      expect(before.skipped[0].reason).toBe('threshold');
      expect(before.switches).toEqual([]);
    });

    it.each([
      ['pending', { pending: true }, 'pending'],
      ['dated in the future', { date: d('2026-12-16') }, 'future'],
      ['of another category', { categoryId: RENT }, 'not_trigger'],
      ['without category (transfer)', { categoryId: null }, 'not_trigger'],
    ] as const)('skips a transaction %s', (_label, extra, reason) => {
      const result = plan({ triggers: [trigger('2026-11-20', extra)] });
      expect(result.switches).toEqual([]);
      expect(result.skipped.map((s) => s.reason)).toEqual([reason]);
    });

    it('skips when there is no active period', () => {
      const result = plan({ active: null, triggers: [trigger('2026-11-20')] });
      expect(result.switches).toEqual([]);
      expect(result.skipped[0].reason).toBe('no_active');
    });
  });

  describe('dates of the switch', () => {
    it('closes the active period the day before and opens the new one on the date (28 Nov)', () => {
      const result = plan({ triggers: [trigger('2026-11-28')] });
      const [sw] = result.switches;
      expect(sw.closed).toEqual({
        id: 'p-active',
        start: d('2026-10-01'),
        end: d('2026-11-27'),
      });
      expect(sw.opened.start).toEqual(d('2026-11-28'));
    });

    it('without recurring salary, ends one month minus one day after the start', () => {
      const result = plan({ triggers: [trigger('2026-11-28')] });
      expect(iso(result.switches[0].opened.end)).toBe('2026-12-27');
      expect(result.switches[0].nextPaie).toBeNull();
    });

    it('brings the end back to the last day of a short month', () => {
      const result = plan({
        active: { id: 'p-active', start: d('2026-01-01') },
        today: d('2026-02-20'),
        triggers: [trigger('2026-01-31')],
      });
      // 31 janv. + 1 mois = 28 févr. ; moins un jour = 27 févr.
      expect(iso(result.switches[0].opened.end)).toBe('2026-02-27');
    });

    it('ends the day before the next salary and creates it pending after the end', () => {
      const result = plan({
        recurring: [salary(28)],
        triggers: [trigger('2026-11-28')],
      });
      const [sw] = result.switches;
      expect(iso(sw.opened.end)).toBe('2026-12-27');
      expect(sw.nextPaie).toMatchObject({
        recurringId: 'rec-salary',
        categoryId: SALARY,
        description: 'Paie',
        amount: 200000n,
      });
      expect(iso(sw.nextPaie!.date)).toBe('2026-12-28');
    });

    it('takes the nearest salary when there are several (at least 15 days away)', () => {
      const result = plan({
        recurring: [salary(28), salary(20, 'rec-bonus', 5000n)],
        triggers: [trigger('2026-11-28')],
      });
      const [sw] = result.switches;
      expect(sw.nextPaie?.recurringId).toBe('rec-bonus');
      expect(iso(sw.opened.end)).toBe('2026-12-19');
    });

    it('does not apply rule A to a negative recurring of the trigger category', () => {
      const result = plan({
        recurring: [salary(28, 'rec-neg', -3000n)],
        triggers: [trigger('2026-11-28')],
      });
      const [sw] = result.switches;
      expect(iso(sw.opened.end)).toBe('2026-12-27');
      expect(sw.nextPaie).toBeNull();
      // traitée comme les autres : injectée si son jour tombe dans la période
      expect(sw.injected.map((o) => [o.recurringId, iso(o.date)])).toEqual([
        ['rec-neg', '2026-11-28'],
      ]);
    });

    it('an occurrence 14 days from the start is neither the end nor injected', () => {
      const result = plan({
        recurring: [salary(12)],
        triggers: [trigger('2026-11-28')],
      });
      const [sw] = result.switches;
      // 12 déc. = début + 14 : ignorée ; 12 janv. = 45 jours : prochaine paie
      expect(iso(sw.nextPaie!.date)).toBe('2027-01-12');
      expect(iso(sw.opened.end)).toBe('2027-01-11');
      expect(sw.injected).toEqual([]);
    });

    it('an occurrence 15 days from the start is the next salary', () => {
      const result = plan({
        recurring: [salary(13)],
        triggers: [trigger('2026-11-28')],
      });
      const [sw] = result.switches;
      expect(iso(sw.nextPaie!.date)).toBe('2026-12-13');
      expect(iso(sw.opened.end)).toBe('2026-12-12');
    });
  });

  describe('sortie du pending : paie datée', () => {
    it('salary planned 28 Nov, taken out 1 Dec: new period 1 Dec to 27 Dec, 28 Dec pending once', () => {
      const result = plan({
        recurring: [salary(28)],
        existing: [
          // la paie qu'on sort : jamais un doublon d'elle-même
          {
            id: 'tx-1',
            recurringId: 'rec-salary',
            date: d('2026-11-28'),
            pending: true,
          },
        ],
        triggers: [trigger('2026-12-01')],
      });
      const [sw] = result.switches;
      expect(iso(sw.closed.end)).toBe('2026-11-30');
      expect(iso(sw.opened.start)).toBe('2026-12-01');
      expect(iso(sw.opened.end)).toBe('2026-12-27');
      expect(sw.injected).toEqual([]);
      expect(sw.nextPaie).not.toBeNull();
      expect(iso(sw.nextPaie!.date)).toBe('2026-12-28');
    });

    it('salary planned 1 Dec, taken out 28 Nov: starts 28 Nov, next salary 1 Jan, end 31 Dec', () => {
      const result = plan({
        today: d('2026-11-28'),
        recurring: [salary(1)],
        existing: [
          {
            id: 'tx-1',
            recurringId: 'rec-salary',
            date: d('2026-12-01'),
            pending: true,
          },
        ],
        triggers: [trigger('2026-11-28')],
      });
      const [sw] = result.switches;
      expect(iso(sw.opened.start)).toBe('2026-11-28');
      // 1er déc. est à 3 jours du début : ni réinjectée ni prochaine paie
      expect(sw.injected).toEqual([]);
      expect(iso(sw.nextPaie!.date)).toBe('2027-01-01');
      expect(iso(sw.opened.end)).toBe('2026-12-31');
    });

    it('does not create the next salary twice when it already exists pending 15 days or more after the start', () => {
      const existing: ExistingRecurringTx[] = [
        {
          id: 'tx-1',
          recurringId: 'rec-salary',
          date: d('2026-11-28'),
          pending: true,
        },
        {
          id: 'tx-9',
          recurringId: 'rec-salary',
          date: d('2026-12-28'),
          pending: true,
        },
      ];
      const result = plan({
        recurring: [salary(28)],
        existing,
        triggers: [trigger('2026-12-01')],
      });
      expect(result.switches[0].nextPaie).toBeNull();
    });

    it('still creates the next salary when the existing one is already paid, or less than 15 days after the start', () => {
      const paid = plan({
        recurring: [salary(28)],
        existing: [
          {
            id: 'tx-9',
            recurringId: 'rec-salary',
            date: d('2026-12-28'),
            pending: false,
          },
        ],
        triggers: [trigger('2026-12-01')],
      });
      const close = plan({
        recurring: [salary(28)],
        existing: [
          {
            id: 'tx-9',
            recurringId: 'rec-salary',
            date: d('2026-12-10'),
            pending: true,
          },
        ],
        triggers: [trigger('2026-12-01')],
      });
      expect(paid.switches[0].nextPaie).not.toBeNull();
      expect(close.switches[0].nextPaie).not.toBeNull();
    });
  });

  describe('injection des récurrentes de la nouvelle période', () => {
    it('injects the recurring whose day falls in the period (one occurrence)', () => {
      const result = plan({
        recurring: [rent],
        triggers: [trigger('2026-11-28')],
      });
      expect(result.switches[0].injected.map((o) => iso(o.date))).toEqual([
        '2026-12-05',
      ]);
    });

    it('does not inject an occurrence already present the same calendar month, whatever its period', () => {
      const result = plan({
        recurring: [rent],
        existing: [
          {
            id: 'tx-r',
            recurringId: 'rec-rent',
            date: d('2026-12-02'),
            pending: false,
          },
        ],
        triggers: [trigger('2026-11-28')],
      });
      expect(result.switches[0].injected).toEqual([]);
    });

    it('injects again when the existing one belongs to another month', () => {
      const result = plan({
        recurring: [rent],
        existing: [
          {
            id: 'tx-r',
            recurringId: 'rec-rent',
            date: d('2026-11-05'),
            pending: false,
          },
        ],
        triggers: [trigger('2026-11-28')],
      });
      expect(result.switches[0].injected).toHaveLength(1);
    });

    it('a salary 14 days after the start is not injected, the other recurring are', () => {
      const result = plan({
        recurring: [salary(12), rent],
        triggers: [trigger('2026-11-28')],
      });
      expect(
        result.switches[0].injected.map((o) => o.recurringId),
      ).not.toContain('rec-salary');
      expect(result.switches[0].injected.map((o) => iso(o.date))).toEqual([
        '2026-12-05',
        '2027-01-05',
      ]);
    });
  });

  describe('windows and period ids', () => {
    it('gives each date the period that contains it, the old active one included', () => {
      const result = plan({ triggers: [trigger('2026-11-28')] });
      expect(periodIdOnDate(result.windows, d('2026-11-27'))).toBe('p-active');
      expect(periodIdOnDate(result.windows, d('2026-11-28'))).toBe('p-new-1');
      expect(periodIdOnDate(result.windows, d('2026-12-27'))).toBe('p-new-1');
      expect(periodIdOnDate(result.windows, d('2026-12-28'))).toBeNull();
      expect(periodIdOnDate(result.windows, d('2026-09-30'))).toBeNull();
    });
  });

  describe('import : plusieurs déclencheuses', () => {
    it('chains three past salaries in date order, one switch each, each line in its own period', () => {
      const result = plan({
        active: { id: 'p-active', start: d('2026-08-28') },
        recurring: [salary(28)],
        triggers: [
          trigger('2026-11-28', { id: 'tx-3' }),
          trigger('2026-09-28', { id: 'tx-1' }),
          trigger('2026-10-28', { id: 'tx-2' }),
        ],
      });
      expect(result.switches.map((s) => iso(s.opened.start))).toEqual([
        '2026-09-28',
        '2026-10-28',
        '2026-11-28',
      ]);
      expect(result.switches.map((s) => iso(s.closed.end))).toEqual([
        '2026-09-27',
        '2026-10-27',
        '2026-11-27',
      ]);
      // chaque ouverture a pour fin la veille de la déclencheuse suivante
      expect(result.switches.map((s) => iso(s.opened.end))).toEqual([
        '2026-10-27',
        '2026-11-27',
        '2026-12-27',
      ]);
      expect(periodIdOnDate(result.windows, d('2026-10-28'))).toBe(
        result.switches[1].opened.id,
      );
    });

    it('only the last switch of the batch creates the next salary', () => {
      const result = plan({
        active: { id: 'p-active', start: d('2026-08-28') },
        recurring: [salary(28)],
        triggers: [
          trigger('2026-09-28', { id: 'tx-1' }),
          trigger('2026-10-28', { id: 'tx-2' }),
        ],
      });
      expect(result.switches[0].nextPaie).toBeNull();
      expect(iso(result.switches[1].nextPaie!.date)).toBe('2026-11-28');
    });

    it('a second salary less than 15 days after the first switch has no switch of its own', () => {
      const result = plan({
        active: { id: 'p-active', start: d('2026-08-01') },
        triggers: [
          trigger('2026-09-28', { id: 'tx-1' }),
          trigger('2026-10-05', { id: 'tx-2' }),
        ],
      });
      expect(result.switches).toHaveLength(1);
      expect(result.skipped).toEqual([
        { triggerId: 'tx-2', reason: 'threshold', gapDays: 7 },
      ]);
    });

    it('does not inject twice the same recurring across the periods of a batch', () => {
      const result = plan({
        active: { id: 'p-active', start: d('2026-08-01') },
        recurring: [rent],
        triggers: [
          trigger('2026-09-28', { id: 'tx-1' }),
          trigger('2026-10-20', { id: 'tx-2' }),
        ],
      });
      const dates = result.switches
        .flatMap((s) => s.injected)
        .map((o) => iso(o.date));
      expect(new Set(dates).size).toBe(dates.length);
    });
  });

  describe('import : nettoyage des pending récurrentes équivalentes', () => {
    const BILLS = 'cat-bills';
    const pendingBill = (
      id: string,
      date: string,
      extra: Partial<ExistingRecurringTx> = {},
    ): ExistingRecurringTx => ({
      id,
      recurringId: `rec-${id}`,
      date: d(date),
      pending: true,
      categoryId: BILLS,
      amount: -5000n,
      ...extra,
    });
    const line = (
      id: string,
      date: string,
      extra: Partial<ImportedLine> = {},
    ): ImportedLine => ({
      id,
      date: d(date),
      pending: false,
      categoryId: BILLS,
      amount: -5000n,
      ...extra,
    });
    const paie = line('paie', '2026-11-28', {
      categoryId: SALARY,
      amount: 200000n,
    });
    const run = (
      existing: ExistingRecurringTx[],
      lines: ImportedLine[],
      extra: Partial<PlanInput> = {},
    ) =>
      plan({
        active: { id: 'p-active', start: d('2026-10-28') },
        triggers: [trigger('2026-11-28', { id: 'paie' })],
        existing,
        importLines: [paie, ...lines],
        ...extra,
      });

    it('removes a pending 7 days from the imported line, keeps one 8 days away', () => {
      const result = run(
        [pendingBill('p7', '2026-11-12'), pendingBill('p8', '2026-11-11')],
        [line('l1', '2026-11-19')],
      );
      expect(result.removedPendingIds).toEqual(['p7']);
      expect(result.remainingPending).toBe(1);
    });

    it('keeps a pending of the opposite sign', () => {
      const result = run(
        [pendingBill('p1', '2026-11-12', { amount: 5000n })],
        [line('l1', '2026-11-12')],
      );
      expect(result.removedPendingIds).toEqual([]);
    });

    it('keeps everything when the category is null', () => {
      const result = run(
        [pendingBill('p1', '2026-11-12', { categoryId: null })],
        [line('l1', '2026-11-12', { categoryId: null })],
      );
      expect(result.removedPendingIds).toEqual([]);
    });

    it('does not require the amount to match', () => {
      const result = run(
        [pendingBill('p1', '2026-11-12', { amount: -99999n })],
        [line('l1', '2026-11-12')],
      );
      expect(result.removedPendingIds).toEqual(['p1']);
    });

    it('with two recurring of the same category, each line removes only one pending (closest amount)', () => {
      const result = run(
        [
          pendingBill('pa', '2026-11-12', { amount: -5000n }),
          pendingBill('pb', '2026-11-12', { amount: -9000n }),
        ],
        [line('l1', '2026-11-12', { amount: -8800n })],
      );
      expect(result.removedPendingIds).toEqual(['pb']);
      expect(result.remainingPending).toBe(1);
    });

    it('breaks ties by closest date then by id', () => {
      const byDate = run(
        [pendingBill('pa', '2026-11-10'), pendingBill('pb', '2026-11-12')],
        [line('l1', '2026-11-13')],
      );
      expect(byDate.removedPendingIds).toEqual(['pb']);
      const byId = run(
        [pendingBill('pb', '2026-11-12'), pendingBill('pa', '2026-11-12')],
        [line('l1', '2026-11-12')],
      );
      expect(byId.removedPendingIds).toEqual(['pa']);
    });

    it('one line removes one pending only', () => {
      const result = run(
        [pendingBill('pa', '2026-11-12'), pendingBill('pb', '2026-11-13')],
        [line('l1', '2026-11-12')],
      );
      expect(result.removedPendingIds).toHaveLength(1);
    });

    it('keeps a pending without recurringId (not in the recurring list)', () => {
      const manual = {
        ...pendingBill('p1', '2026-11-12'),
      } as Partial<ExistingRecurringTx>;
      // une pending manuelle n'est jamais passée dans `existing` : aucune candidate
      const result = run([], [line('l1', '2026-11-12')]);
      expect(manual.id).toBe('p1');
      expect(result.removedPendingIds).toEqual([]);
    });

    it('keeps a pending already reconciled or paid (not pending)', () => {
      const result = run(
        [pendingBill('p1', '2026-11-12', { pending: false })],
        [line('l1', '2026-11-12')],
      );
      expect(result.removedPendingIds).toEqual([]);
    });

    it('ignores an imported line that is itself pending', () => {
      const result = run(
        [pendingBill('p1', '2026-11-12')],
        [line('l1', '2026-11-12', { pending: true })],
      );
      expect(result.removedPendingIds).toEqual([]);
    });

    it('removes the planned salary pending (1 Dec) when the salary is imported on 28 Nov, and still creates the next one', () => {
      const result = run(
        [
          pendingBill('ps', '2026-12-01', {
            recurringId: 'rec-salary',
            categoryId: SALARY,
            amount: 200000n,
          }),
        ],
        [],
        { recurring: [salary(1)] },
      );
      expect(result.removedPendingIds).toEqual(['ps']);
      expect(iso(result.switches[0].nextPaie!.date)).toBe('2027-01-01');
    });

    it('a removed pending still counts as already present for injection, never for the next salary', () => {
      const removedNext = run(
        [
          pendingBill('ps', '2026-12-20', {
            recurringId: 'rec-salary',
            categoryId: SALARY,
            amount: 200000n,
          }),
        ],
        [line('lp', '2026-12-18', { categoryId: SALARY, amount: 200000n })],
        {
          recurring: [salary(20)],
          today: d('2026-12-18'),
        },
      );
      expect(removedNext.removedPendingIds).toEqual(['ps']);
      // (b) la prochaine paie (20 déc. >= 28 nov. + 15 j) est créée : la supprimée ne la bloque pas
      expect(removedNext.switches[0].nextPaie).not.toBeNull();

      // facture du 25 nov. (pending, période close) retirée : l'occurrence du 29 nov. n'est pas réinjectée (c)
      const billPending = run(
        [pendingBill('pb', '2026-11-25')],
        [line('lb', '2026-11-25')],
        {
          recurring: [
            { ...rent, id: 'rec-pb', categoryId: BILLS, dayOfMonth: 29 },
            salary(1),
          ],
        },
      );
      expect(billPending.removedPendingIds).toEqual(['pb']);
      expect(billPending.switches[0].injected.map((o) => iso(o.date))).toEqual([
        '2026-12-29',
      ]);
    });

    it('does not inject an occurrence whose equivalent was imported (bill of the 29th imported with the salary of the 28th)', () => {
      const result = run([], [line('l29', '2026-11-29')], {
        recurring: [
          { ...rent, id: 'rec-bill', categoryId: BILLS, dayOfMonth: 29 },
          salary(1),
        ],
      });
      expect(result.switches[0].injected.map((o) => iso(o.date))).toEqual([
        '2026-12-29',
      ]);
    });

    it('still injects the occurrence when the imported line was consumed by a pending removal', () => {
      const result = run(
        [pendingBill('p1', '2026-11-12')],
        [line('l1', '2026-11-12')],
        {
          recurring: [
            { ...rent, id: 'rec-bill', categoryId: BILLS, dayOfMonth: 12 },
          ],
        },
      );
      // 12 nov. est avant la nouvelle période (28 nov.) : rien à injecter, mais la ligne est appariée
      expect(result.removedPendingIds).toEqual(['p1']);
    });

    it('never touches the next salary with an imported line', () => {
      const result = run([], [], { recurring: [salary(1)] });
      expect(iso(result.switches[0].nextPaie!.date)).toBe('2027-01-01');
    });

    it('intermediate periods of an import inject nothing, only the last one does', () => {
      const result = plan({
        active: { id: 'p-active', start: d('2026-08-01') },
        recurring: [rent],
        triggers: [
          trigger('2026-09-28', { id: 'tx-1' }),
          trigger('2026-10-28', { id: 'tx-2' }),
        ],
        importLines: [],
      });
      expect(result.switches[0].injected).toEqual([]);
      expect(result.switches[1].injected.length).toBeGreaterThan(0);
    });

    it('does nothing without switch: nothing removed', () => {
      const result = plan({
        active: { id: 'p-active', start: d('2026-11-20') },
        triggers: [trigger('2026-11-28', { id: 'paie' })],
        existing: [pendingBill('p1', '2026-11-12')],
        importLines: [paie, line('l1', '2026-11-12')],
      });
      expect(result.switches).toEqual([]);
      expect(result.removedPendingIds).toEqual([]);
    });

    it('without importLines (simple entry): nothing removed', () => {
      const result = plan({
        active: { id: 'p-active', start: d('2026-10-28') },
        triggers: [trigger('2026-11-28', { id: 'paie' })],
        existing: [pendingBill('p1', '2026-11-12')],
      });
      expect(result.removedPendingIds).toEqual([]);
    });

    it('keeps ids of opened periods stable', () => {
      const result = run(
        [pendingBill('p1', '2026-11-12')],
        [line('l1', '2026-11-12')],
      );
      expect(result.switches[0].opened.id).toBe(result.windows[1].id);
    });
  });
});
