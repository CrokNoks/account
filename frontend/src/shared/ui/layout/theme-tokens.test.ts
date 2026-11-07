import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../../../app/[locale]/globals.css'), 'utf8');
const block = (selector: string) => css.split(`${selector} {`)[1].split('\n}')[0];

describe('jetons de la maquette', () => {
  it.each([
    [':root', { background: '#F7F7F5', card: '#FFFFFF', foreground: '#15181C', 'muted-foreground': '#5B636D', border: '#E3E4E0', primary: '#2450C8', warn: '#B4530A', accent: '#EEF0EC', prev: '#8A9199' }],
    ['.dark', { background: '#111316', card: '#181B1F', foreground: '#ECEEF0', 'muted-foreground': '#A0A7B0', border: '#2A2F35', primary: '#6C90E8', warn: '#CC7A36', accent: '#22262B', prev: '#7C838B' }],
  ])('%s reprend les valeurs de .t-light / .t-dark', (selector, expected) => {
    const b = block(selector);
    for (const [token, value] of Object.entries(expected)) {
      expect(b, token).toMatch(new RegExp(`--${token}: ${value};`));
    }
  });

  it('expose warn et prev comme couleurs utilisables', () => {
    expect(css).toContain('--color-warn: var(--warn);');
    expect(css).toContain('--color-prev: var(--prev);');
  });

  it('mappe les polices sur les variables posées par next/font, sans référence circulaire', () => {
    expect(css).toContain('--font-sans: var(--font-geist-sans);');
    expect(css).toContain('--font-mono: var(--font-geist-mono);');
    expect(css).not.toMatch(/--([a-z-]+): var\(--\1\)/);
  });

  it('pose les variables de police sur <html>, ancêtre de tout le rendu (portails compris)', () => {
    const root = readFileSync(join(__dirname, '../../../app/layout.tsx'), 'utf8');
    expect(root).toMatch(/<html[^>]*geistSans\.variable[^>]*geistMono\.variable/);
  });
});
