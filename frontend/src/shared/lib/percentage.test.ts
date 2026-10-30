import { describe, expect, it } from 'vitest';
import { expensePulsePercentage } from './percentage';

const b = (n: number) => BigInt(n);

describe('expensePulsePercentage', () => {
  it('returns 0 when the reference total is 0', () => {
    expect(expensePulsePercentage(b(0), b(-500))).toBe(0);
  });
  it('rounds instead of truncating (-249.5 -> -250)', () => {
    expect(expensePulsePercentage(b(-200), b(-299))).toBe(-250);
  });
  it('rounds -166.67 to -167, not -166', () => {
    expect(expensePulsePercentage(b(-300), b(-200))).toBe(-167);
  });
  it('rounds .5 away from zero on both signs', () => {
    expect(expensePulsePercentage(b(-200), b(-1))).toBe(-101); // -100.5
    expect(expensePulsePercentage(b(200), b(-401))).toBe(101); // 100.5
  });
  it('keeps exact results', () => {
    expect(expensePulsePercentage(b(-100), b(-100))).toBe(-200);
  });
});
