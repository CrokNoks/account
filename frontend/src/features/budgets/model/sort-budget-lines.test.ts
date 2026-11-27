import { describe, expect, it } from 'vitest';
import { BudgetBreakdownResponse, BudgetCategoryBreakdown } from '@/features/reporting/model/types';
import { sortBudgetLines, sortBudgetRows } from './sort-budget-lines';

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

  it('un remboursement (réel positif) ne consomme rien : derrière les lignes consommées, jamais en tête', () => {
    const result = sortBudgetLines({
      ...empty,
      expenses: [line('R0', '3462', '0'), line('R1', '5000', '10000'), line('A', '-100', '10000'), line('Z', '-300', '0')],
    });
    expect(names(result)).toEqual(['Z', 'A', 'R1', 'R0']);
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

describe('sens d\'un virement (CA6)', () => {
  const transfer = (name: string, real: string, budget: string, direction?: 'outgoing' | 'incoming') => ({
    ...line(name, real, budget),
    ...(direction ? { direction } : {}),
  });

  it('un virement sortant se classe avec les dépenses, par consommation ; un entrant va dans les revenus, par nom', () => {
    const rows = sortBudgetRows({
      income: [line('Prime', '0', '0')],
      expenses: [line('Courses', '-2000', '10000'), line('Loisirs', '-9000', '10000')],
      savings: [],
      transfers: [
        transfer('Salaire Lucas', '203300', '203300', 'incoming'),
        transfer('Virement CJ', '-100000', '-203248', 'outgoing'),
        transfer('Vide', '0', '0', 'incoming'),
      ],
    });
    expect(rows.map((r) => r.line.name)).toEqual(['Loisirs', 'Virement CJ', 'Courses', 'Prime', 'Salaire Lucas', 'Vide']);
    const flags = Object.fromEntries(rows.map((r) => [r.line.name, [r.isIncome, r.isRevenue]]));
    expect(flags['Virement CJ']).toEqual([false, false]); // dépense : colonne Reste, dépassement possible
    expect(flags['Salaire Lucas']).toEqual([true, true]); // revenu : Réel et Budget, sans Reste
    expect(flags['Vide']).toEqual([true, true]);
  });

  it('un virement sortant sans budget avec du réel passe devant, comme une dépense sans budget', () => {
    const rows = sortBudgetRows({
      ...empty,
      expenses: [line('A', '-2000', '10000')],
      transfers: [transfer('Virement CJ', '-50000', '0', 'outgoing')],
    });
    expect(rows.map((r) => r.line.name)).toEqual(['Virement CJ', 'A']);
  });

  it('un virement sans direction (back plus ancien) est lu comme entrant', () => {
    const rows = sortBudgetRows({ ...empty, transfers: [transfer('Virement', '0', '5000')] });
    expect(rows[0]).toMatchObject({ isIncome: true, isRevenue: true });
  });
});
