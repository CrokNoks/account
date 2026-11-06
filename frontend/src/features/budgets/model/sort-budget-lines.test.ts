import { describe, expect, it } from 'vitest';
import { BudgetBreakdownResponse, BudgetCategoryBreakdown } from '@/features/reporting/model/types';
import { sortBudgetLines } from './sort-budget-lines';

const line = (name: string, real: string, budget: string): BudgetCategoryBreakdown => ({
  categoryId: name,
  name,
  real,
  budget,
  remaining: '0',
  percentage: 0,
});

const empty: BudgetBreakdownResponse = { income: [], expenses: [], savings: [], transfers: [] };
const names = (r: ReturnType<typeof sortBudgetLines>) => r.map((l) => l.name);

describe('sortBudgetLines', () => {
  it('sorts expenses and savings by consumed share, descending, mixed in one list', () => {
    const result = sortBudgetLines({
      ...empty,
      expenses: [line('A', '-5000', '10000'), line('B', '-9000', '10000')],
      savings: [line('C', '-7000', '10000')],
    });
    expect(names(result)).toEqual(['B', 'C', 'A']);
  });

  it('puts a zero budget with real spending first, by descending real', () => {
    const result = sortBudgetLines({
      ...empty,
      expenses: [line('A', '-20000', '10000'), line('Z1', '-300', '0'), line('Z2', '-900', '0')],
    });
    expect(names(result)).toEqual(['Z2', 'Z1', 'A']);
  });

  it('puts categories with neither budget nor real last among expenses, by name', () => {
    const result = sortBudgetLines({
      ...empty,
      expenses: [line('N2', '0', '0'), line('A', '0', '10000'), line('N1', '0', '0'), line('B', '-100', '10000')],
    });
    expect(names(result)).toEqual(['B', 'A', 'N1', 'N2']);
  });

  it('breaks ties by name', () => {
    const result = sortBudgetLines({
      ...empty,
      expenses: [line('B', '-5000', '10000'), line('A', '-500', '1000')],
    });
    expect(names(result)).toEqual(['A', 'B']);
  });

  it('compares ratios exactly (100,00 % vs 100,01 %)', () => {
    const result = sortBudgetLines({
      ...empty,
      expenses: [line('A', '-10000', '10000'), line('B', '-100010000', '100000000')],
    });
    expect(names(result)).toEqual(['B', 'A']);
  });

  it('handles amounts beyond the safe integer range', () => {
    const result = sortBudgetLines({
      ...empty,
      expenses: [line('A', '-9007199254740993', '9007199254740993'), line('B', '-9007199254740994', '9007199254740993')],
    });
    expect(names(result)).toEqual(['B', 'A']);
  });

  it('lists income then transfers after expenses and savings', () => {
    const result = sortBudgetLines({
      income: [line('Salaire', '200000', '200000')],
      expenses: [line('A', '0', '0')],
      savings: [],
      transfers: [line('Virement', '0', '0')],
    });
    expect(names(result)).toEqual(['A', 'Salaire', 'Virement']);
  });
});
