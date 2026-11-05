import { Logger } from '@nestjs/common';
import { GetOverrunsByPeriodUseCase } from './get-overruns-by-period.use-case';
import { GetCategoryOverrunsChartUseCase } from './get-category-overruns-chart.use-case';
import { Period } from '../../periods/domain/period.entity';
import {
  Category,
  CategoryType,
} from '../../categories/domain/category.entity';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';
import {
  DomainValidationError,
  NotFoundError,
} from '../../shared/domain/errors';

const category = (id: string, type: CategoryType) =>
  new Category({
    id,
    name: `Nom ${id}`,
    color: '#000000',
    type,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const period = (id: string, start: string, end: string, isActive = false) =>
  Period.create({
    id,
    accountId: 'acc-1',
    startDate: new Date(start),
    endDate: new Date(end),
    isActive,
  });

const tx = (
  amount: number,
  categoryId: string | null,
  date: string,
  periodId?: string,
  pending = false,
) =>
  Transaction.create({
    accountId: 'acc-1',
    categoryId,
    periodId,
    date: new Date(date),
    description: 'tx',
    amount: BigInt(amount),
    reconciled: false,
    pending,
  });

const budget = (periodId: string, categoryId: string, amount: number) =>
  BudgetInstance.create({
    periodId,
    categoryId,
    amountAllocated: BigInt(amount),
  });

describe('Overruns use cases', () => {
  const p1 = period('p1', '2026-01-01', '2026-01-31');
  const p2 = period('p2', '2026-02-01', '2026-02-28');
  const p3 = period('p3', '2026-03-01', '2026-03-31');
  const active = period('p4', '2026-04-01', '2026-04-30', true);
  const foreign = Period.create({
    id: 'px',
    accountId: 'autre',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31'),
    isActive: false,
  });

  let periods: { findById: jest.Mock; findAllByAccount: jest.Mock };
  let transactions: { findAllByAccountUnpaginated: jest.Mock };
  let budgets: { findAllByPeriod: jest.Mock };
  let categories: { findAllByAccount: jest.Mock };
  let allTx: Transaction[];
  let allBudgets: BudgetInstance[];
  let list: GetOverrunsByPeriodUseCase;
  let chart: GetCategoryOverrunsChartUseCase;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    allTx = [];
    allBudgets = [];
    // Volontairement désordonnées : le tri est du ressort du cas d'usage.
    const all = [p2, active, p1, p3, foreign];
    periods = {
      findById: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(all.find((p) => p.id === id) ?? null),
        ),
      findAllByAccount: jest
        .fn()
        .mockResolvedValue(all.filter((p) => p.accountId === 'acc-1')),
    };
    categories = {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([
          category('salaire', CategoryType.INCOME),
          category('courses', CategoryType.EXPENSE),
          category('livret', CategoryType.SAVINGS),
        ]),
    };
    // Les transactions sont filtrées par dates, comme le dépôt réel.
    transactions = {
      findAllByAccountUnpaginated: jest
        .fn()
        .mockImplementation(
          (_: string, f: { startDate: Date; endDate?: Date }) =>
            Promise.resolve(
              allTx.filter(
                (t) =>
                  t.date >= f.startDate && (!f.endDate || t.date <= f.endDate),
              ),
            ),
        ),
    };
    budgets = {
      findAllByPeriod: jest
        .fn()
        .mockImplementation((pid: string) =>
          Promise.resolve(allBudgets.filter((b) => b.periodId === pid)),
        ),
    };
    const repos = [categories, transactions, budgets, periods] as never[];
    list = new GetOverrunsByPeriodUseCase(
      repos[0],
      repos[1],
      repos[2],
      repos[3],
    );
    chart = new GetCategoryOverrunsChartUseCase(
      repos[0],
      repos[1],
      repos[2],
      repos[3],
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe('liste par période', () => {
    it('ne renvoie que les périodes fermées, la plus récente en premier', async () => {
      const res = await list.execute('acc-1');
      expect(res.periods.map((p) => p.periodId)).toEqual(['p3', 'p2', 'p1']);
    });

    it('renvoie une liste vide sans période fermée', async () => {
      periods.findAllByAccount.mockResolvedValue([active]);
      expect((await list.execute('acc-1')).periods).toEqual([]);
    });

    it('garde une période sans dépassement avec une liste vide', async () => {
      allBudgets.push(budget('p1', 'courses', 10000));
      allTx.push(tx(-5000, 'courses', '2026-01-10'));
      const res = await list.execute('acc-1');
      expect(res.periods.find((p) => p.periodId === 'p1')?.overruns).toEqual(
        [],
      );
    });

    it('liste le dépassement avec budget, réel et excédent en chaîne', async () => {
      allBudgets.push(budget('p1', 'courses', -10000));
      allTx.push(tx(-12000, 'courses', '2026-01-10'));
      const res = await list.execute('acc-1');
      expect(res.periods[2].overruns).toEqual([
        {
          categoryId: 'courses',
          name: 'Nom courses',
          budget: '10000',
          real: '-12000',
          overrun: '2000',
        },
      ]);
    });

    it('rattache les transactions par dates, pas par period_id', async () => {
      allBudgets.push(budget('p2', 'courses', 10000));
      // period_id = p1 mais date dans p2
      allTx.push(tx(-15000, 'courses', '2026-02-10', 'p1'));
      const res = await list.execute('acc-1');
      expect(res.periods.find((p) => p.periodId === 'p2')?.overruns).toEqual([
        expect.objectContaining({ overrun: '5000' }),
      ]);
      expect(res.periods.find((p) => p.periodId === 'p1')?.overruns).toEqual(
        [],
      );
    });

    it('trace overruns_report_built sans montant ni libellé', async () => {
      allBudgets.push(budget('p1', 'courses', 10000));
      allTx.push(tx(-12000, 'courses', '2026-01-10'));
      await list.execute('acc-1');
      expect(logSpy).toHaveBeenCalledWith({
        event: 'overruns_report_built',
        accountId: 'acc-1',
        periodCount: 3,
        overrunCount: 1,
      });
    });
  });

  describe('graphique', () => {
    beforeEach(() => {
      allBudgets.push(
        budget('p1', 'courses', -10000),
        budget('p3', 'courses', 8000),
      );
      allTx.push(
        tx(-12000, 'courses', '2026-01-10'),
        tx(-99000, 'courses', '2026-02-10'),
        tx(-8000, 'courses', '2026-03-10'),
      );
    });

    it('renvoie une barre par période de P1 à P2, en ordre chronologique, budget en valeur absolue', async () => {
      const res = await chart.execute('acc-1', 'courses', 'p1', 'p3');
      expect(res.points.map((p) => p.periodId)).toEqual(['p1', 'p2', 'p3']);
      expect(res.points.map((p) => p.budget)).toEqual(['10000', '0', '8000']);
    });

    it('période sans budget : budget 0 et dépassement 0, barre présente', async () => {
      const res = await chart.execute('acc-1', 'courses', 'p1', 'p3');
      expect(res.points[1]).toMatchObject({ budget: '0', overrun: '0' });
      expect(res.points[2].overrun).toBe('0'); // égalité exacte
    });

    it('P1 = P2 : une seule barre', async () => {
      const res = await chart.execute('acc-1', 'courses', 'p2', 'p2');
      expect(res.points).toHaveLength(1);
    });

    it('une seule période fermée : une barre', async () => {
      periods.findAllByAccount.mockResolvedValue([p1, active]);
      const res = await chart.execute('acc-1', 'courses', 'p1', 'p1');
      expect(res.points).toHaveLength(1);
    });

    it('même dépassement que la liste', async () => {
      const l = await list.execute('acc-1');
      const c = await chart.execute('acc-1', 'courses', 'p1', 'p3');
      for (const point of c.points) {
        const fromList = l.periods
          .find((p) => p.periodId === point.periodId)
          ?.overruns.find((o) => o.categoryId === 'courses');
        expect(point.overrun).toBe(fromList?.overrun ?? '0');
      }
    });

    it('refuse P1 après P2 sans permuter', async () => {
      await expect(
        chart.execute('acc-1', 'courses', 'p3', 'p1'),
      ).rejects.toBeInstanceOf(DomainValidationError);
    });

    it('refuse une période active', async () => {
      await expect(
        chart.execute('acc-1', 'courses', 'p1', 'p4'),
      ).rejects.toBeInstanceOf(DomainValidationError);
    });

    it("refuse une période d'un autre compte (404)", async () => {
      await expect(
        chart.execute('acc-1', 'courses', 'px', 'p3'),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        chart.execute('acc-1', 'courses', 'p1', 'px'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('refuse une catégorie inconnue (404) ou de revenu (400)', async () => {
      await expect(
        chart.execute('acc-1', 'inconnue', 'p1', 'p3'),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        chart.execute('acc-1', 'salaire', 'p1', 'p3'),
      ).rejects.toBeInstanceOf(DomainValidationError);
    });

    it('trace overruns_chart_built sans montant ni libellé', async () => {
      await chart.execute('acc-1', 'courses', 'p1', 'p3');
      expect(logSpy).toHaveBeenCalledWith({
        event: 'overruns_chart_built',
        accountId: 'acc-1',
        categoryId: 'courses',
        startPeriodId: 'p1',
        endPeriodId: 'p3',
        periodCount: 3,
      });
    });
  });
});
