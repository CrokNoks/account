import { isLeavingPending, resolvePending } from './pending-rule';

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

describe('isLeavingPending', () => {
  it('is true only for the pending to not pending transition', () => {
    expect(isLeavingPending(true, false)).toBe(true);
    expect(isLeavingPending(false, false)).toBe(false);
    expect(isLeavingPending(false, true)).toBe(false);
    expect(isLeavingPending(true, true)).toBe(false);
  });

  it('counts reconciling a pending transaction as leaving pending', () => {
    expect(isLeavingPending(true, resolvePending(true, undefined, true))).toBe(
      true,
    );
  });
});
