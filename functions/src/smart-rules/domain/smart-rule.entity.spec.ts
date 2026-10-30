import { SmartRule } from './smart-rule.entity';

describe('SmartRule', () => {
  const rule = (pattern: string) =>
    SmartRule.create({
      accountId: 'acc-1',
      pattern,
      categoryId: 'cat-1',
      tagIds: [],
      priority: 0,
    });

  it('matches when the pattern is contained in the description, case-insensitively', () => {
    expect(rule('carrefour').matches('CB CARREFOUR MARKET 12/03')).toBe(true);
    expect(rule('CARREFOUR').matches('cb carrefour market')).toBe(true);
  });

  it('does not match when the pattern is absent', () => {
    expect(rule('leclerc').matches('CB CARREFOUR MARKET')).toBe(false);
  });

  it('treats the pattern as plain text, not as a regex', () => {
    expect(rule('a.c').matches('abc')).toBe(false);
    expect(rule('a.c').matches('xa.cx')).toBe(true);
  });

  it('generates an id and timestamps on create', () => {
    const r = rule('x');
    expect(r.id).toBeDefined();
    expect(r.createdAt).toBeInstanceOf(Date);
    expect(r.updatedAt).toEqual(r.createdAt);
  });

  it('updates updatedAt when a field changes', () => {
    const r = rule('x');
    const before = r.updatedAt;
    jest.useFakeTimers().setSystemTime(before.getTime() + 1000);
    r.updatePriority(5);
    jest.useRealTimers();
    expect(r.priority).toBe(5);
    expect(r.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });
});
