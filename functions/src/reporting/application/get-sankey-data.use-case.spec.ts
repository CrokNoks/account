import { GetSankeyDataUseCase } from './get-sankey-data.use-case';
import {
  BudgetBreakdownResponse,
  BudgetCategoryBreakdown,
  GetBudgetBreakdownUseCase,
} from './get-budget-breakdown.use-case';

const item = (categoryId: string, real: number): BudgetCategoryBreakdown => ({
  categoryId,
  name: `Nom ${categoryId}`,
  real: String(real),
  budget: '0',
  remaining: '0',
  percentage: 0,
});

describe('GetSankeyDataUseCase', () => {
  let getBreakdown: { execute: jest.Mock };
  let useCase: GetSankeyDataUseCase;

  const breakdown: BudgetBreakdownResponse = {
    income: [item('salaire', 250000)],
    expenses: [item('courses', -45000), item('loisirs', 0)],
    savings: [item('livret', -20000)],
    transfers: [],
  };

  beforeEach(() => {
    getBreakdown = { execute: jest.fn().mockResolvedValue(breakdown) };
    useCase = new GetSankeyDataUseCase(
      getBreakdown as unknown as GetBudgetBreakdownUseCase,
    );
  });

  it('builds the fixed nodes then one node per non-empty category', async () => {
    const { nodes } = await useCase.execute('acc-1', 'per-1');

    expect(getBreakdown.execute).toHaveBeenCalledWith('acc-1', 'per-1');
    expect(nodes).toEqual([
      { name: 'Revenus', color: '#10b981' },
      { name: 'Compte', color: '#6366f1' },
      { name: 'Dépenses', color: '#ef4444' },
      { name: 'Épargne', color: '#3b82f6' },
      { name: 'Virements', color: '#8b5cf6' },
      { name: 'Nom salaire', color: undefined },
      { name: 'Nom courses', color: undefined },
      { name: 'Nom livret', color: undefined },
    ]);
  });

  it('links income → account → groups → categories, in euros, by node index', async () => {
    const { links } = await useCase.execute('acc-1', 'per-1');

    expect(links).toEqual([
      { source: 5, target: 0, value: 2500 },
      { source: 0, target: 1, value: 2500 },
      { source: 1, target: 2, value: 450 },
      { source: 1, target: 3, value: 200 },
      { source: 2, target: 6, value: 450 },
      { source: 3, target: 7, value: 200 },
    ]);
  });

  it('keeps cents as decimals', async () => {
    getBreakdown.execute.mockResolvedValue({
      ...breakdown,
      income: [item('salaire', 123456)],
    });

    const { links } = await useCase.execute('acc-1', 'per-1');

    expect(links[0].value).toBe(1234.56);
  });

  it('returns only the fixed nodes and no link for an empty period', async () => {
    getBreakdown.execute.mockResolvedValue({
      income: [],
      expenses: [],
      savings: [],
      transfers: [],
    });

    const { nodes, links } = await useCase.execute('acc-1', 'per-1');

    expect(nodes).toHaveLength(5);
    expect(links).toEqual([]);
  });
});
