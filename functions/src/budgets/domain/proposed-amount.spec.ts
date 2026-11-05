import {
  proposedAmountForConfigScreen,
  proposedAmountForPeriod,
} from './proposed-amount';

describe('proposedAmountForPeriod', () => {
  it('returns the configured amount', () => {
    expect(proposedAmountForPeriod(50000n)).toBe(50000n);
  });
  it('returns 0 when not configured', () => {
    expect(proposedAmountForPeriod(undefined)).toBe(0n);
  });
  it('returns 0 for a line configured at 0', () => {
    expect(proposedAmountForPeriod(0n)).toBe(0n);
  });
  it('keeps a negative amount', () => {
    expect(proposedAmountForPeriod(-8000n)).toBe(-8000n);
  });
});

describe('proposedAmountForConfigScreen', () => {
  it('configured amount wins over recurring', () => {
    expect(proposedAmountForConfigScreen(50000n, [12000n])).toBe(50000n);
  });
  it('sums recurring when not configured', () => {
    expect(proposedAmountForConfigScreen(undefined, [12000n, 3050n])).toBe(
      15050n,
    );
  });
  it('treats a line at 0 as not configured', () => {
    expect(proposedAmountForConfigScreen(0n, [12000n])).toBe(12000n);
  });
  it('returns 0 when not configured and no recurring', () => {
    expect(proposedAmountForConfigScreen(undefined, [])).toBe(0n);
  });
  it('keeps a negative configured amount, no sum', () => {
    expect(proposedAmountForConfigScreen(-8000n, [12000n])).toBe(-8000n);
  });
});
