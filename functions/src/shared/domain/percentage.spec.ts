import { roundedPercentage } from './percentage';

const b = (n: number | string) => BigInt(n);

describe('roundedPercentage', () => {
  it('rounds half away from zero (positive)', () => {
    expect(roundedPercentage(b(225), b(200))).toBe(113);
    expect(roundedPercentage(b(528), b(1000))).toBe(53);
    expect(roundedPercentage(b(524), b(1000))).toBe(52);
  });
  it('rounds half away from zero (negative)', () => {
    expect(roundedPercentage(b(-225), b(200))).toBe(-113);
    expect(roundedPercentage(b(225), b(-200))).toBe(-113);
    expect(roundedPercentage(b(-225), b(-200))).toBe(113);
  });
  it('returns 0 when the denominator is 0', () => {
    expect(roundedPercentage(b(100), b(0))).toBe(0);
    expect(roundedPercentage(b(100), b(0), 2)).toBe(0);
  });
  it('supports decimals', () => {
    expect(roundedPercentage(b(10), b(30), 2)).toBe(33.33);
    expect(roundedPercentage(b(20), b(30), 2)).toBe(66.67);
    expect(roundedPercentage(b(-20), b(30), 2)).toBe(-66.67);
  });
  it('does not return -0', () => {
    expect(Object.is(roundedPercentage(b(-1), b(1000)), 0)).toBe(true);
  });
  it('is exact on huge amounts', () => {
    const big = b('900000000000000000000001');
    expect(roundedPercentage(big, big)).toBe(100);
    expect(roundedPercentage(big * b(3), big * b(2))).toBe(150);
    expect(
      roundedPercentage(b('9007199254740993'), b('18014398509481986')),
    ).toBe(50);
  });
});
