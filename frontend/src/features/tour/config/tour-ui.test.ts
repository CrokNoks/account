import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { DASHBOARD_STEPS } from './dashboard-tour';
import { ACCOUNT_STEPS } from './account-tour';
import { TRANSACTION_STEPS } from './transactions-tour';
import { tourLocale, tourStyles } from './tour-ui';

type Messages = { Common: Record<string, string>; Tour: Record<string, unknown> };

describe('bulle de la visite guidée', () => {
  for (const [name, messages, next] of [
    ['français', fr, 'Suivant'],
    ['anglais', en, 'Next'],
  ] as const) {
    it(`le bouton « Suivant » est traduit avec la progression (${name})`, () => {
      const m = messages as unknown as Messages;
      const locale = tourLocale((k) => m.Common[k], m.Tour.next_with_progress as string);
      expect(locale.next).toBe(next);
      expect(locale.nextLabelWithProgress).toContain(next);
      if (name === 'français') expect(locale.nextLabelWithProgress).not.toMatch(/Next|Step/);
      expect(locale.nextLabelWithProgress).toContain('{step}');
      expect(locale.nextLabelWithProgress).toContain('{steps}');
    });
  }

  it('les couleurs ne passent pas par hsl() (variables du thème en oklch)', () => {
    for (const dark of [false, true]) {
      const s = tourStyles(dark);
      expect(JSON.stringify(s)).not.toContain('hsl(');
      expect(s.buttonNext?.color).toBe('var(--primary-foreground)');
    }
  });
});

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) && !p.includes('features/tour/config') ? [p] : [];
  });

describe('cibles des visites guidées', () => {
  const sources = sourceFiles(join(__dirname, '../../..'))
    .map((p) => readFileSync(p, 'utf8'))
    .filter((c) => c.includes('data-tour'));
  const t = ((k: string) => k) as unknown as Parameters<typeof DASHBOARD_STEPS>[0];

  for (const [name, steps] of [
    ['dashboard', DASHBOARD_STEPS(t)],
    ['account', ACCOUNT_STEPS(t)],
    ['transactions', TRANSACTION_STEPS(t)],
  ] as const) {
    it(`chaque étape de la visite « ${name} » vise un élément posé dans le code`, () => {
      const missing = steps
        .map((s) => String(s.target))
        .filter((target) => target !== 'body')
        .filter((target) => {
          const id = /data-tour="([^"]+)"/.exec(target)?.[1];
          return !id || !sources.some((c) => c.includes(`"${id}"`) || c.includes(`'${id}'`));
        });
      expect(missing).toEqual([]);
    });
  }

  it("la visite du tableau de bord n'inclut pas l'étape évolution (page Évolution seulement)", () => {
    const targets = DASHBOARD_STEPS(((k: string) => k) as unknown as Parameters<typeof DASHBOARD_STEPS>[0]).map((s) => s.target);
    expect(targets).not.toContain('[data-tour="evolution"]');
  });
});
