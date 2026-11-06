import { describe, expect, it } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';

const strings = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];

describe('budget vocabulary', () => {
  it('never shows « budgets fixes » / « fixed budgets » on screen', () => {
    expect(strings(fr).filter((s) => /budgets? fixes?/i.test(s))).toEqual([]);
    expect(strings(en).filter((s) => /fixed budgets?/i.test(s))).toEqual([]);
  });

  it('names the defaults screen « Montants par défaut des nouvelles périodes »', () => {
    expect(fr.BudgetTemplates.title).toBe('Montants par défaut des nouvelles périodes');
    expect(fr.BudgetTemplates.link).toBe('Montants par défaut des nouvelles périodes');
    expect(en.BudgetTemplates.title).toBe('Default amounts for new periods');
  });
});
