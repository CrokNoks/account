import { describe, expect, it } from 'vitest';
import { currentOverruns } from './current-overruns';

const item = (categoryId: string, name: string, remaining: string) => ({
  categoryId,
  name,
  real: '0',
  budget: '0',
  remaining,
  percentage: 0,
});

describe('currentOverruns', () => {
  it('garde les dépenses et l\'épargne au restant négatif, avec le montant du dépassement', () => {
    const result = currentOverruns({
      expenses: [item('e1', 'Courses', '-10000'), item('e2', 'Loisirs', '7000'), item('e3', 'Cadeaux', '0')],
      savings: [item('s1', 'Vacances', '-500')],
      income: [item('i1', 'Salaire', '-10000')],
      transfers: [item('t1', 'Virement', '-100')],
    });

    expect(result).toEqual([
      { categoryId: 'e1', name: 'Courses', amount: '10000' },
      { categoryId: 's1', name: 'Vacances', amount: '500' },
    ]);
  });

  it('rend une liste vide sans répartition', () => {
    expect(currentOverruns(undefined)).toEqual([]);
  });
});
