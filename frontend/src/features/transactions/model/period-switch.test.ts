import { describe, expect, it } from 'vitest';
import { extractPeriodSwitch, type PeriodSwitch } from './period-switch';

const sw: PeriodSwitch = {
  closed: { id: 'p1', startDate: '2026-10-01', endDate: '2026-11-27' },
  opened: { id: 'p2', startDate: '2026-11-28', endDate: '2026-12-27' },
  count: 1,
  dateChanged: false,
};

describe('extractPeriodSwitch', () => {
  it('reads the switch of a single response', () => {
    expect(extractPeriodSwitch({ id: 't1', periodSwitch: sw })).toEqual(sw);
  });

  it('reads the switch carried by the elements of an import response', () => {
    expect(extractPeriodSwitch([{ id: 't1', periodSwitch: sw }, { id: 't2', periodSwitch: sw }])).toEqual(sw);
  });

  it('returns null without a switch, on an empty response or on a malformed one', () => {
    expect(extractPeriodSwitch({ id: 't1' })).toBeNull();
    expect(extractPeriodSwitch([{ id: 't1' }])).toBeNull();
    expect(extractPeriodSwitch(undefined)).toBeNull();
    expect(extractPeriodSwitch('')).toBeNull();
    expect(extractPeriodSwitch({ periodSwitch: {} })).toBeNull();
  });
});
