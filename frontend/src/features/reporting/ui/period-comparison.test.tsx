import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparisonGap } from './period-comparison';

const lang = vi.hoisted(() => ({ locale: 'fr' }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => lang.locale,
}));

const point = (period1Real: string, period2Real: string, percentageDiff: number) => ({
  categoryId: 'c',
  name: 'C',
  period1Real,
  period2Real,
  diff: String(BigInt(period2Real) - BigInt(period1Real)),
  percentageDiff,
});

const gap = (item: ReturnType<typeof point>, isExpense?: boolean, isSavings?: boolean) =>
  render(<ComparisonGap item={item} isExpense={isExpense} isSavings={isSavings} />).getByTestId('comparison-gap');

// Les espaces insécables varient selon la version d'ICU (U+00A0 ou U+202F) : on compare avec des espaces simples.
const text = (el: HTMLElement) => el.textContent!.replace(/[\u00a0\u202f]/g, ' ');

describe('ComparisonGap', () => {
  beforeEach(() => {
    lang.locale = 'fr';
  });

  it('shows an expense that went down as a green decrease', () => {
    const cell = gap(point('-8560', '-4014', -53.11), true);
    expect(text(cell)).toBe(`-45,46 € -53,11 %`);
    expect(cell.className).toContain('text-primary');
  });

  it('shows an expense that went up as an orange increase', () => {
    const cell = gap(point('-3683', '-3685', 0.05), true);
    expect(text(cell)).toBe(`+0,02 € +0,05 %`);
    expect(cell.className).toContain('text-warn');
  });

  it('shows an income that went up as a green increase', () => {
    const cell = gap(point('250000', '260000', 4));
    expect(text(cell)).toBe(`+100,00 € +4 %`);
    expect(cell.className).toContain('text-primary');
  });

  it('shows a category absent from the base period as new, red for an expense', () => {
    const cell = gap(point('0', '-16410', 0), true);
    expect(cell.textContent).toBe('new');
    expect(cell.className).toContain('text-warn');
  });

  it('shows an unchanged amount as neutral', () => {
    const cell = gap(point('-1078', '-1078', 0), true);
    expect(text(cell)).toBe(`0,00 € 0 %`);
    expect(cell.className).toContain('text-muted-foreground');
  });

  it("garde une couleur neutre pour l'épargne en hausse, ni rouge ni positive, avec flèche et signe", () => {
    const up = gap(point('-1000', '-2000', 100), true, true);
    expect(text(up)).toBe(`+10,00 € +100 %`);
    expect(up.className).toContain('text-muted-foreground');
    expect(up.className).not.toContain('text-warn');
    expect(up.className).not.toContain('text-primary');
    expect(up.querySelector('svg')).not.toBeNull();
  });

  it("garde une couleur neutre pour l'épargne en baisse ou nouvelle", () => {
    expect(gap(point('-2000', '-1000', -50), true, true).className).toContain('text-muted-foreground');
  });

  it("garde une couleur neutre pour une épargne nouvelle", () => {
    const cell = gap(point('0', '-1000', 0), true, true);
    expect(cell.textContent).toBe('new');
    expect(cell.className).toContain('text-muted-foreground');
  });

  it("compare le montant consommé d'une dépense : un remboursement sur la période comparée est une baisse, verte", () => {
    const cell = gap(point('-5000', '2000', -140), true);
    expect(text(cell)).toBe(`-50,00 € -100 %`);
    expect(cell.className).toContain('text-primary');
  });

  it("une dépense qui était remboursée sur la période de base est nouvelle, orange", () => {
    const cell = gap(point('2000', '-3000', -250), true);
    expect(cell.textContent).toBe('new');
    expect(cell.className).toContain('text-warn');
  });

  it("deux périodes remboursées : rien consommé, écart neutre à zéro", () => {
    const cell = gap(point('2000', '5000', 150), true);
    expect(text(cell)).toBe(`0,00 € 0 %`);
    expect(cell.className).toContain('text-muted-foreground');
  });

  it("écrit l'écart au format de la langue : virgule en français, point en anglais", () => {
    const fr = render(<ComparisonGap item={point('-8560', '-4014', -53.11)} isExpense />);
    expect(text(fr.getByTestId('comparison-gap'))).toContain(`-53,11 %`);
    fr.unmount();
    lang.locale = 'en';
    expect(text(gap(point('-8560', '-4014', -53.11), true))).toContain('-€45.46 -53.11%');
  });
});
