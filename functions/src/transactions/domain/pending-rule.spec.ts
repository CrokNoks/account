import { DomainValidationError } from '../../shared/domain/errors';
import {
  assertNotReconciledAndPending,
  isLeavingPending,
  resolvePending,
} from './pending-rule';

describe('resolvePending', () => {
  it('P4 : clears pending when reconciling', () => {
    expect(resolvePending(true, undefined, true, false)).toBe(false);
  });

  it('P5 : refuses reconciled and pending both true in the same body', () => {
    expect(() => resolvePending(true, true, true, false)).toThrow(
      DomainValidationError,
    );
    expect(() => resolvePending(true, true, false, false)).toThrow(
      DomainValidationError,
    );
  });

  it('P3 : refuses pending: true on an already reconciled transaction', () => {
    expect(() => resolvePending(undefined, true, false, true)).toThrow(
      DomainValidationError,
    );
  });

  it('P6 : un-reconciling and setting pending in the same body is allowed', () => {
    expect(resolvePending(false, true, false, true)).toBe(true);
  });

  it('keeps pending: false on a reconciled transaction', () => {
    expect(resolvePending(undefined, false, false, true)).toBe(false);
    expect(resolvePending(undefined, undefined, false, true)).toBe(false);
  });

  it('applies the provided pending otherwise', () => {
    expect(resolvePending(undefined, true, false, false)).toBe(true);
    expect(resolvePending(false, false, true, false)).toBe(false);
  });

  it('keeps the existing pending when nothing is provided', () => {
    expect(resolvePending(undefined, undefined, true, false)).toBe(true);
    expect(resolvePending(false, undefined, false, false)).toBe(false);
  });
});

describe('assertNotReconciledAndPending (creation, import)', () => {
  it('P1 : refuses both true', () => {
    expect(() => assertNotReconciledAndPending(true, true)).toThrow(
      DomainValidationError,
    );
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [undefined, undefined],
    [undefined, true],
    [true, undefined],
  ])('P2 : accepts reconciled=%s pending=%s', (reconciled, pending) => {
    expect(() =>
      assertNotReconciledAndPending(reconciled, pending),
    ).not.toThrow();
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
    expect(
      isLeavingPending(true, resolvePending(true, undefined, true, false)),
    ).toBe(true);
  });
});
