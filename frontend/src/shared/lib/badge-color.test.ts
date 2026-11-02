import { describe, expect, it } from 'vitest';
import { tintedBadgeStyle } from './badge-color';

describe('tintedBadgeStyle', () => {
  it('never uses the category colour as text colour (unreadable when dark on dark)', () => {
    const style = tintedBadgeStyle('#111111');

    expect(style.color).toBeUndefined();
    expect(style.borderColor).toBe('#111111');
    expect(style.backgroundColor).toBe('#11111126');
  });

  it('adds no colour when the category has none', () => {
    expect(tintedBadgeStyle(undefined)).toEqual({});
  });
});
