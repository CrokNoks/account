import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AmountInput } from './amount-input';
import { parseAmountToCents } from '@/shared/lib/format';

describe('AmountInput', () => {
  it('opens the full mobile keyboard (iOS keypads for number/decimal/numeric have no "-")', () => {
    render(<AmountInput placeholder="amount" />);
    const input = screen.getByPlaceholderText('amount') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('text');
    expect(input.getAttribute('pattern')).toBeNull();
  });

  it('cannot be overridden back to a keypad without "-"', () => {
    // @ts-expect-error type and inputMode are not part of the public props
    render(<AmountInput placeholder="amount" type="number" inputMode="decimal" />);
    const input = screen.getByPlaceholderText('amount') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('text');
  });

  it('keeps a typed negative amount with a decimal comma, readable as cents', async () => {
    render(<AmountInput placeholder="amount" />);
    const input = screen.getByPlaceholderText('amount') as HTMLInputElement;
    await userEvent.type(input, '-12,5');
    expect(input.value).toBe('-12,5');
    expect(parseAmountToCents(input.value)).toBe(BigInt(-1250));
  });
});
