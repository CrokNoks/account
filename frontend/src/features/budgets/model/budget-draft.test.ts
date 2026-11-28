import { describe, expect, it } from 'vitest';
import {
  buildBudgets,
  changedDrafts,
  draftErrors,
  displayValue,
  hasChanges,
  directionsOf,
  buildTemplateItems,
} from './budget-draft';

const NONE = {};

const reference = [
  { categoryId: 'a', amountAllocated: '40000' },
  { categoryId: 'b', amountAllocated: '-8000' },
  { categoryId: 'c', amountAllocated: '25000' },
];

describe('changedDrafts', () => {
  it('drops a draft equal to the saved amount, however it is written', () => {
    expect(changedDrafts(reference, { a: '400', b: '-80,00', c: '260' })).toEqual({ c: '260' });
  });

  it('an empty field equals 0, so equals an absent budget', () => {
    expect(changedDrafts(reference, { z: '', y: '0' })).toEqual({});
    expect(changedDrafts(reference, { a: '' })).toEqual({ a: '' });
  });

  it('keeps an unreadable text as changed', () => {
    expect(changedDrafts(reference, { a: 'abc' })).toEqual({ a: 'abc' });
  });

  it('hasChanges follows', () => {
    expect(hasChanges(reference, { a: '400' })).toBe(false);
    expect(hasChanges(reference, { a: '401' })).toBe(true);
  });
});

describe('draftErrors', () => {
  it('flags unreadable and negative new values, not an untouched negative budget', () => {
    expect(draftErrors(reference, { a: 'abc', c: '-5', b: '-80' }, NONE)).toEqual({ a: 'unreadable', c: 'negative' });
  });

  it('an empty field is valid (0)', () => {
    expect(draftErrors(reference, { a: '' }, NONE)).toEqual({});
  });
});

describe('buildBudgets', () => {
  it('sends the complete list: untouched budgets, even negative, are sent as they were read', () => {
    expect(buildBudgets(reference, { c: '300,50' }, NONE)).toEqual([
      { categoryId: 'a', amountAllocated: '40000' },
      { categoryId: 'b', amountAllocated: '-8000' },
      { categoryId: 'c', amountAllocated: '30050' },
    ]);
  });

  it('adds a budget for a category that had none, and sends 0 for an emptied field', () => {
    expect(buildBudgets(reference, { z: '12', a: '' }, NONE)).toEqual([
      { categoryId: 'a', amountAllocated: '0' },
      { categoryId: 'b', amountAllocated: '-8000' },
      { categoryId: 'c', amountAllocated: '25000' },
      { categoryId: 'z', amountAllocated: '1200' },
    ]);
  });

  it('ignores a draft that came back to the saved amount', () => {
    expect(buildBudgets(reference, { a: '400' }, NONE)).toEqual(reference);
  });
});

describe('displayValue', () => {
  it('shows the draft text as typed, else the saved amount, empty for no budget', () => {
    expect(displayValue(reference, {}, 'a', 'en')).toBe('400.00');
    expect(displayValue(reference, { a: '4' }, 'a', 'en')).toBe('4');
    expect(displayValue(reference, {}, 'zz', 'en')).toBe('');
  });

  it('writes the amount in the decimal separator of the language', () => {
    expect(displayValue(reference, {}, 'a', 'fr')).toBe('400,00');
    expect(displayValue(reference, {}, 'c', 'fr')).toBe('250,00');
    expect(displayValue(reference, {}, 'a', 'en')).toBe('400.00');
  });

  it('shows a budget stored as negative by its absolute value', () => {
    expect(displayValue(reference, {}, 'b', 'fr')).toBe('80,00');
    expect(displayValue(reference, {}, 'b', 'en')).toBe('80.00');
  });

  it('the displayed text is read back to the same amount (no change, no error)', () => {
    for (const locale of ['fr', 'en']) {
      const drafts = Object.fromEntries(reference.map((b) => [b.categoryId, displayValue(reference, {}, b.categoryId, locale)]));
      expect(changedDrafts(reference, drafts)).toEqual({});
      expect(draftErrors(reference, drafts, NONE)).toEqual({});
      expect(buildBudgets(reference, drafts, NONE)).toEqual(reference);
    }
  });
});

describe('negative stored budget', () => {
  it('typing a new amount saves it positive; the other negative budgets stay as read', () => {
    const two = [...reference, { categoryId: 'd', amountAllocated: '-500' }];
    expect(draftErrors(two, { b: '95,50' }, NONE)).toEqual({});
    expect(buildBudgets(two, { b: '95,50' }, NONE)).toEqual([
      { categoryId: 'a', amountAllocated: '40000' },
      { categoryId: 'b', amountAllocated: '9550' },
      { categoryId: 'c', amountAllocated: '25000' },
      { categoryId: 'd', amountAllocated: '-500' },
    ]);
  });

  it('a new negative typed amount is still refused', () => {
    expect(draftErrors(reference, { b: '-95' }, NONE)).toEqual({ b: 'negative' });
  });
});

// Saisie qui garde le sens d'un virement : `directions` vient du back (jamais recalculé ici).
describe('sens d\'un virement', () => {
  const cj = { categoryId: 'cj', amountAllocated: '-203248' };
  const sal = { categoryId: 'sal', amountAllocated: '203300' };
  const dir = { cj: 'outgoing', sal: 'incoming', vide: 'incoming', cjSansBudget: 'outgoing' } as const;
  const ref = [cj, sal, { categoryId: 'a', amountAllocated: '40000' }];

  const saved = (drafts: Record<string, string>, reference = ref) => {
    const list = buildBudgets(reference, drafts, dir);
    return Object.fromEntries(list.map((b) => [b.categoryId, b.amountAllocated]));
  };

  it('CJ budgété -2032,48, 2100,00 tapé : enregistré -2100,00', () => {
    expect(saved({ cj: '2100,00' }).cj).toBe('-210000');
  });

  it('CJ sans budget cette période mais avec des sorties (sens par le réel), 2100,00 : -2100,00', () => {
    expect(saved({ cjSansBudget: '2100,00' }, ref).cjSansBudget).toBe('-210000');
  });

  it('CJ budget remis à 0 puis 2100,00 ressaisi : -2100,00 (le réel négatif donne le sens)', () => {
    const zero = [{ categoryId: 'cj', amountAllocated: '0' }];
    expect(saved({ cj: '2100,00' }, zero).cj).toBe('-210000');
  });

  it('virement sans budget ni opération, 500,00 : +500,00', () => {
    expect(saved({ vide: '500,00' }).vide).toBe('50000');
  });

  it('CJ, retaper la valeur affichée (2032,48) : pas un changement, budget renvoyé tel quel', () => {
    const shown = displayValue(ref, {}, 'cj', 'fr');
    expect(shown).toBe('2032,48');
    expect(changedDrafts(ref, { cj: shown })).toEqual({});
    expect(saved({ cj: shown }).cj).toBe('-203248');
  });

  it('un montant négatif tapé est accepté pour un virement et en fait un sortant', () => {
    expect(draftErrors(ref, { cj: '-500', vide: '-500' }, dir)).toEqual({});
    expect(saved({ cj: '-500' }).cj).toBe('-50000');
    expect(saved({ vide: '-500' }).vide).toBe('-50000');
  });

  it('Salaire +2033,00, -100 tapé : accepté, devient sortant', () => {
    expect(draftErrors(ref, { sal: '-100' }, dir)).toEqual({});
    expect(saved({ sal: '-100' }).sal).toBe('-10000');
  });

  it('une catégorie qui n\'est pas un virement refuse toujours le négatif', () => {
    expect(draftErrors(ref, { a: '-500' }, dir)).toEqual({ a: 'negative' });
  });

  it('Salaire entrant, 2500,00 tapé : reste positif', () => {
    expect(saved({ sal: '2500,00' }).sal).toBe('250000');
  });

  it('CJ champ vidé : 0', () => {
    expect(saved({ cj: '' }).cj).toBe('0');
  });

  it('une saisie illisible reste une erreur, même sur un virement', () => {
    expect(draftErrors(ref, { cj: 'abc' }, dir)).toEqual({ cj: 'unreadable' });
  });

  it('directionsOf : ne garde que les lignes qui portent un sens', () => {
    expect(
      directionsOf([
        { categoryId: 'cj', direction: 'outgoing' },
        { categoryId: 'a' },
      ]),
    ).toEqual({ cj: 'outgoing' });
  });
});

describe('buildTemplateItems', () => {
  const item = (categoryId: string, amount: string) => ({ categoryId, amount });

  it('une ligne par catégorie du compte, absent = 0', () => {
    const budgets = [
      { categoryId: 'A', amountAllocated: '10000' },
      { categoryId: 'B', amountAllocated: '2500' },
    ];
    expect(buildTemplateItems(['A', 'B', 'C'], budgets)).toEqual([item('A', '10000'), item('B', '2500'), item('C', '0')]);
  });

  it('un budget à 0 reste 0', () => {
    expect(buildTemplateItems(['B'], [{ categoryId: 'B', amountAllocated: '0' }])).toEqual([item('B', '0')]);
  });

  it('un virement sortant garde son signe', () => {
    expect(buildTemplateItems(['V'], [{ categoryId: 'V', amountAllocated: '-5000' }])).toEqual([item('V', '-5000')]);
  });

  it('un budget négatif hors virement est repris tel quel', () => {
    expect(buildTemplateItems(['D'], [{ categoryId: 'D', amountAllocated: '-300' }])).toEqual([item('D', '-300')]);
  });

  it('ignore un budget dont la catégorie n\'est pas au compte', () => {
    expect(buildTemplateItems(['A'], [{ categoryId: 'Z', amountAllocated: '900' }])).toEqual([item('A', '0')]);
  });

  it('reprend les saisies quand on part de buildBudgets', () => {
    const ref = [{ categoryId: 'A', amountAllocated: '10000' }];
    expect(buildTemplateItems(['A'], buildBudgets(ref, { A: '12,00' }, {}))).toEqual([item('A', '1200')]);
  });

  it('aucune catégorie : liste vide', () => {
    expect(buildTemplateItems([], [{ categoryId: 'A', amountAllocated: '1' }])).toEqual([]);
  });
});
