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
    expect(displayValue(reference, {}, 'a')).toBe('400.00');
    expect(displayValue(reference, {}, 'b')).toBe('-80.00');
    expect(displayValue(reference, { a: '4' }, 'a')).toBe('4');
    expect(displayValue(reference, {}, 'zz')).toBe('');
  });
});
