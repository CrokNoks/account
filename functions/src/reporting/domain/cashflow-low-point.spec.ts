import { computeLowPoint } from './cashflow-low-point';

const START = new Date('2026-04-28T00:00:00.000Z');
const day = (n: number) =>
  new Date(START.getTime() + n * 86400000).toISOString();
const ev = (n: number, amount: number) => ({
  date: day(n),
  amount: BigInt(amount),
});

describe('computeLowPoint', () => {
  it('returns today and the starting balance without any event', () => {
    expect(computeLowPoint(START, BigInt(100000), [])).toEqual({
      date: day(0),
      balance: BigInt(100000),
    });
  });

  it('compares end-of-day balances, not intermediate ones', () => {
    expect(
      computeLowPoint(START, BigInt(100000), [ev(3, -90000), ev(3, 100000)]),
    ).toEqual({ date: day(0), balance: BigInt(100000) });
  });

  it("counts today's own events", () => {
    expect(computeLowPoint(START, BigInt(100000), [ev(0, -3000)])).toEqual({
      date: day(0),
      balance: BigInt(97000),
    });
  });

  it('keeps the first day on a tie', () => {
    expect(
      computeLowPoint(START, BigInt(100000), [
        ev(2, -50000),
        ev(3, 50000),
        ev(4, -50000),
      ]),
    ).toEqual({ date: day(2), balance: BigInt(50000) });
  });

  it('keeps today when a later day ties with it', () => {
    expect(
      computeLowPoint(START, BigInt(100000), [
        ev(2, -0),
        ev(3, -50000),
        ev(5, 50000),
      ]).date,
    ).toBe(day(3));
    expect(
      computeLowPoint(START, BigInt(100000), [
        ev(2, -50000),
        ev(5, 50000),
        ev(6, 0),
      ]).date,
    ).toBe(day(2));
    expect(
      computeLowPoint(START, BigInt(100000), [ev(2, 0), ev(3, -0)]).date,
    ).toBe(day(0));
  });

  it('is today when there are only inflows', () => {
    expect(
      computeLowPoint(START, BigInt(100000), [ev(1, 5000), ev(4, 7000)]),
    ).toEqual({ date: day(0), balance: BigInt(100000) });
  });

  it('handles a negative balance', () => {
    const low = computeLowPoint(START, BigInt(10000), [
      ev(3, -30000),
      ev(6, -5000),
    ]);
    expect(low).toEqual({ date: day(6), balance: BigInt(-25000) });
    expect(low.balance.toString()).toBe('-25000');
  });
});
