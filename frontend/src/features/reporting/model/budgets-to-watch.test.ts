import { describe, expect, it } from 'vitest';
import { budgetsToWatch } from './budgets-to-watch';
import type { BudgetCategoryBreakdown } from './types';

const line = (name: string, real: string, budget: string): BudgetCategoryBreakdown => ({
  categoryId: name,
  name,
  real,
  budget,
  remaining: '0',
  percentage: 0,
});

const empty = { income: [], expenses: [], savings: [], transfers: [] };

describe('budgetsToWatch', () => {
  it('ne renvoie rien sans répartition', () => {
    expect(budgetsToWatch(undefined)).toEqual([]);
    expect(budgetsToWatch(null)).toEqual([]);
  });

  it('garde 5 lignes au plus, dans l\'ordre de sortBudgetRows (dépassés d\'abord)', () => {
    const expenses = [
      line('A', '-1000', '10000'),
      line('B', '-9000', '10000'),
      line('C', '-12000', '10000'),
      line('D', '-5000', '10000'),
      line('E', '-100', '10000'),
      line('F', '-6000', '10000'),
    ];
    expect(budgetsToWatch({ ...empty, expenses }).map((l) => l.name)).toEqual(['C', 'B', 'F', 'D', 'A']);
  });

  it('prend aussi l\'épargne, jamais les revenus ni les virements', () => {
    const result = budgetsToWatch({
      income: [line('Salaire', '300000', '300000')],
      expenses: [line('Courses', '-5000', '10000')],
      savings: [line('Livret', '-9000', '10000')],
      transfers: [line('Virement', '-100', '100')],
    });
    expect(result.map((l) => l.name)).toEqual(['Livret', 'Courses']);
  });

  it('met devant un budget à 0 avec du réel, omet une ligne sans budget ni réel', () => {
    const expenses = [line('Vide', '0', '0'), line('Normal', '-5000', '10000'), line('Hors budget', '-300', '0')];
    expect(budgetsToWatch({ ...empty, expenses }).map((l) => l.name)).toEqual(['Hors budget', 'Normal']);
  });

  it('omet une ligne dont la dépense égale le budget, garde 0 dépensé avec un budget', () => {
    const expenses = [
      line('Assurance Crédit Immo.', '-18342', '18342'),
      line('Pas encore dépensé', '0', '10000'),
      line('Vide', '0', '0'),
    ];
    expect(budgetsToWatch({ ...empty, expenses }).map((l) => l.name)).toEqual(['Pas encore dépensé']);
  });
});
