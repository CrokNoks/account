import { resolvePending } from './pending-rule';

describe('resolvePending', () => {
  it('clears pending when reconciling, even if pending is provided', () => {
    expect(resolvePending(true, undefined, true)).toBe(false);
    expect(resolvePending(true, true, true)).toBe(false);
  });

  it('applies the provided pending otherwise', () => {
    expect(resolvePending(undefined, true, false)).toBe(true);
    expect(resolvePending(false, false, true)).toBe(false);
  });

  it('keeps the existing pending when nothing is provided', () => {
    expect(resolvePending(undefined, undefined, true)).toBe(true);
    expect(resolvePending(false, undefined, false)).toBe(false);
  });
});
