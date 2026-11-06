import { describe, expect, it } from 'vitest';
import { absCents, buildBreakdown } from './breakdown';

const pt = (categoryId: string, period1Real: string, period2Real: string) => ({
  categoryId,
  name: categoryId,
  period1Real,
  period2Real,
  diff: '0',
  percentageDiff: 0,
});

describe('buildBreakdown', () => {
  it("additionne dépenses et épargne de la période affichée, sans les revenus ni les virements", () => {
    const b = buildBreakdown({
      income: [pt('salaire', '0', '200000')],
      expenses: [pt('courses', '-5000', '-12000'), pt('loisirs', '-1000', '-2550')],
      savings: [pt('livret', '0', '-3000')],
      transfers: [pt('vir', '0', '-99999')],
    });
    expect(b.total).toBe('17550');
    expect(b.compareTotal).toBe('6000');
    expect(b.rows.map((r) => r.categoryId)).toEqual(['courses', 'livret', 'loisirs']);
    expect(b.rows.map((r) => r.isSavings)).toEqual([false, true, false]);
  });

  it('masque une catégorie à 0 sur les deux périodes, garde celle qui a disparu', () => {
    const b = buildBreakdown({
      income: [],
      expenses: [pt('vide', '0', '0'), pt('ancienne', '-4000', '0')],
      savings: [],
      transfers: [],
    });
    expect(b.rows.map((r) => r.categoryId)).toEqual(['ancienne']);
    expect(b.total).toBe('0');
  });

  it("n'arrondit pas : somme exacte en centimes entiers", () => {
    expect(absCents('-9007199254740993')).toBe('9007199254740993');
    expect(absCents('250')).toBe('250');
  });
});
