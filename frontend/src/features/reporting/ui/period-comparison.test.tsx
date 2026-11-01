import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComparisonGap } from './period-comparison';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const point = (period1Real: string, period2Real: string, percentageDiff: number) => ({
  categoryId: 'c',
  name: 'C',
  period1Real,
  period2Real,
  diff: String(BigInt(period2Real) - BigInt(period1Real)),
  percentageDiff,
});

const gap = (item: ReturnType<typeof point>, isExpense?: boolean) =>
  render(<ComparisonGap item={item} isExpense={isExpense} />).getByTestId('comparison-gap');

describe('ComparisonGap', () => {
  it('shows an expense that went down as a green decrease', () => {
    const cell = gap(point('-8560', '-4014', -53.11), true);
    expect(cell.textContent).toBe('-53.11%');
    expect(cell.className).toContain('text-emerald-600');
  });

  it('shows an expense that went up as a red increase', () => {
    const cell = gap(point('-3683', '-3685', 0.05), true);
    expect(cell.textContent).toBe('+0.05%');
    expect(cell.className).toContain('text-rose-600');
  });

  it('shows an income that went up as a green increase', () => {
    const cell = gap(point('250000', '260000', 4));
    expect(cell.textContent).toBe('+4%');
    expect(cell.className).toContain('text-emerald-600');
  });

  it('shows a category absent from the base period as new, red for an expense', () => {
    const cell = gap(point('0', '-16410', 0), true);
    expect(cell.textContent).toBe('new');
    expect(cell.className).toContain('text-rose-600');
  });

  it('shows an unchanged amount as neutral', () => {
    const cell = gap(point('-1078', '-1078', 0), true);
    expect(cell.textContent).toBe('0%');
    expect(cell.className).toContain('text-muted-foreground');
  });
});
