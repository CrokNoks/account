import { describe, expect, it } from 'vitest';
import { closedPeriodsChronological, defaultOverrunsRange, isRangeInverted } from './overruns-range';

const mk = (n: number, isActive = false) => ({
  id: `p${n}`,
  startDate: `2026-${String(n).padStart(2, '0')}-01T00:00:00.000Z`,
  endDate: `2026-${String(n).padStart(2, '0')}-28T00:00:00.000Z`,
  isActive,
});

describe('overruns range', () => {
  it('keeps closed periods only, oldest first', () => {
    expect(closedPeriodsChronological([mk(3), mk(1), mk(4, true), mk(2)]).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('defaults to the last closed period and the one 6 ranks before (7 bars)', () => {
    const closed = closedPeriodsChronological([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => mk(n)));
    expect(defaultOverrunsRange(closed)).toEqual({ startId: 'p3', endId: 'p9' });
  });

  it('defaults to the oldest closed period when there are fewer than 7', () => {
    const closed = closedPeriodsChronological([1, 2, 3].map((n) => mk(n)));
    expect(defaultOverrunsRange(closed)).toEqual({ startId: 'p1', endId: 'p3' });
  });

  it('gives a single bar with one closed period, nothing with none', () => {
    expect(defaultOverrunsRange([mk(1)])).toEqual({ startId: 'p1', endId: 'p1' });
    expect(defaultOverrunsRange([])).toBeNull();
  });

  it('refuses P1 after P2 but accepts P1 = P2', () => {
    const closed = closedPeriodsChronological([1, 2, 3].map((n) => mk(n)));
    expect(isRangeInverted(closed, 'p3', 'p1')).toBe(true);
    expect(isRangeInverted(closed, 'p2', 'p2')).toBe(false);
    expect(isRangeInverted(closed, 'p1', 'p3')).toBe(false);
  });
});
