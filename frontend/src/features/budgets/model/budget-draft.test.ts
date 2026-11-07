import { describe, expect, it } from 'vitest';
import {
  buildBudgets,
  changedDrafts,
  draftErrors,
  displayValue,
  hasChanges,
} from './budget-draft';

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
    expect(draftErrors(reference, { a: 'abc', c: '-5', b: '-80' })).toEqual({ a: 'unreadable', c: 'negative' });
  });

  it('an empty field is valid (0)', () => {
    expect(draftErrors(reference, { a: '' })).toEqual({});
  });
});

describe('buildBudgets', () => {
  it('sends the complete list: untouched budgets, even negative, are sent as they were read', () => {
    expect(buildBudgets(reference, { c: '300,50' })).toEqual([
      { categoryId: 'a', amountAllocated: '40000' },
      { categoryId: 'b', amountAllocated: '-8000' },
      { categoryId: 'c', amountAllocated: '30050' },
    ]);
  });

  it('adds a budget for a category that had none, and sends 0 for an emptied field', () => {
    expect(buildBudgets(reference, { z: '12', a: '' })).toEqual([
      { categoryId: 'a', amountAllocated: '0' },
      { categoryId: 'b', amountAllocated: '-8000' },
      { categoryId: 'c', amountAllocated: '25000' },
      { categoryId: 'z', amountAllocated: '1200' },
    ]);
  });

  it('ignores a draft that came back to the saved amount', () => {
    expect(buildBudgets(reference, { a: '400' })).toEqual(reference);
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
      expect(draftErrors(reference, drafts)).toEqual({});
      expect(buildBudgets(reference, drafts)).toEqual(reference);
    }
  });
});

describe('negative stored budget', () => {
  it('typing a new amount saves it positive; the other negative budgets stay as read', () => {
    const two = [...reference, { categoryId: 'd', amountAllocated: '-500' }];
    expect(draftErrors(two, { b: '95,50' })).toEqual({});
    expect(buildBudgets(two, { b: '95,50' })).toEqual([
      { categoryId: 'a', amountAllocated: '40000' },
      { categoryId: 'b', amountAllocated: '9550' },
      { categoryId: 'c', amountAllocated: '25000' },
      { categoryId: 'd', amountAllocated: '-500' },
    ]);
  });

  it('a new negative typed amount is still refused', () => {
    expect(draftErrors(reference, { b: '-95' })).toEqual({ b: 'negative' });
  });
});
