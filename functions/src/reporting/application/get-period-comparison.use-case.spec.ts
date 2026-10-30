import { GetPeriodComparisonUseCase } from './get-period-comparison.use-case';
import {
  BudgetBreakdownResponse,
  BudgetCategoryBreakdown,
  GetBudgetBreakdownUseCase,
} from './get-budget-breakdown.use-case';

const item = (
  categoryId: string,
  real: number,
  name = `Nom ${categoryId}`,
): BudgetCategoryBreakdown => ({
  categoryId,
  name,
  real: String(real),
  budget: '0',
  remaining: '0',
  percentage: 0,
});

const breakdown = (
  partial: Partial<BudgetBreakdownResponse>,
): BudgetBreakdownResponse => ({
  income: [],
  expenses: [],
  savings: [],
  transfers: [],
  ...partial,
});

describe('GetPeriodComparisonUseCase', () => {
  let getBreakdown: { execute: jest.Mock };
  let useCase: GetPeriodComparisonUseCase;

  beforeEach(() => {
    getBreakdown = {
      execute: jest.fn((_: string, periodId: string) =>
        Promise.resolve(
          periodId === 'p1'
            ? breakdown({
                income: [item('salaire', 250000)],
                expenses: [item('courses', -45000), item('loisirs', -10000)],
              })
            : breakdown({
                income: [item('salaire', 260000)],
                expenses: [item('courses', -30000), item('voyage', -80000)],
              }),
        ),
      ),
    };
    useCase = new GetPeriodComparisonUseCase(
      getBreakdown as unknown as GetBudgetBreakdownUseCase,
    );
  });

  it('loads the breakdown of both periods', async () => {
    await useCase.execute('acc-1', 'p1', 'p2');

    expect(getBreakdown.execute).toHaveBeenCalledWith('acc-1', 'p1');
    expect(getBreakdown.execute).toHaveBeenCalledWith('acc-1', 'p2');
  });

  it('computes the difference period2 - period1 and its percentage of |period1|', async () => {
    const { expenses, income } = await useCase.execute('acc-1', 'p1', 'p2');

    expect(expenses.find((c) => c.categoryId === 'courses')).toEqual({
      categoryId: 'courses',
      name: 'Nom courses',
      period1Real: '-45000',
      period2Real: '-30000',
      diff: '15000',
      percentageDiff: 33.33,
    });
    expect(income[0]).toMatchObject({ diff: '10000', percentageDiff: 4 });
  });

  it('includes categories present in only one of the periods', async () => {
    const { expenses } = await useCase.execute('acc-1', 'p1', 'p2');

    expect(expenses.map((c) => c.categoryId)).toEqual([
      'courses',
      'loisirs',
      'voyage',
    ]);
    expect(expenses.find((c) => c.categoryId === 'loisirs')).toMatchObject({
      period2Real: '0',
      diff: '10000',
      percentageDiff: 100,
    });
  });

  it('returns 0 % when the category was empty in period 1', async () => {
    const { expenses } = await useCase.execute('acc-1', 'p1', 'p2');

    expect(expenses.find((c) => c.categoryId === 'voyage')).toMatchObject({
      period1Real: '0',
      diff: '-80000',
      percentageDiff: 0,
    });
  });

  it('returns empty groups when both periods are empty', async () => {
    getBreakdown.execute.mockResolvedValue(breakdown({}));

    expect(await useCase.execute('acc-1', 'p1', 'p2')).toEqual(breakdown({}));
  });
});
