import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartLegend } from './chart-legend';
import { CHART } from './chart-style';

const css = readFileSync(join(__dirname, '../../../../app/[locale]/globals.css'), 'utf8');
const block = (selector: string) => css.split(`${selector} {`)[1].split('\n}')[0];
const token = (selector: string, name: string) => block(selector).match(new RegExp(`--${name}: (#[0-9A-Fa-f]{6});`))![1];

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('barre de budget', () => {
  const name = CHART.budget.replace('var(--', '').replace(')', '');

  it.each([':root', '.dark'])('%s : contraste d\'au moins 3:1 sur la carte et sur le fond', (selector) => {
    const color = token(selector, name);
    expect(contrast(color, token(selector, 'card'))).toBeGreaterThanOrEqual(3);
    expect(contrast(color, token(selector, 'background'))).toBeGreaterThanOrEqual(3);
  });

  it('le carré de légende utilise la même teinte que la barre dessinée', () => {
    const { container } = render(<ChartLegend items={[{ label: 'Budget', kind: 'bar-budget' }]} note="n" />);
    expect(name).toBe('muted-foreground');
    expect(container.querySelector('li span')!.className).toContain('bg-muted-foreground');
  });
});
