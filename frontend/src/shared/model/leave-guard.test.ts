import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmLeave, registerLeaveGuard } from './leave-guard';

describe('leave guard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lets go without asking when nothing is registered or nothing is typed', () => {
    const ask = vi.spyOn(window, 'confirm');
    expect(confirmLeave()).toBe(true);
    const off = registerLeaveGuard(() => false, 'x');
    expect(confirmLeave()).toBe(true);
    off();
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks when there are unsaved inputs and follows the answer', () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const off = registerLeaveGuard(() => true, 'Abandonner ?');
    expect(confirmLeave()).toBe(false);
    expect(confirmLeave()).toBe(true);
    expect(ask).toHaveBeenCalledWith('Abandonner ?');
    off();
    expect(confirmLeave()).toBe(true);
  });
});
