import { describe, expect, it } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { DASHBOARD_STEPS } from './dashboard-tour';

type Messages = { Tour: Record<string, Record<string, string>> };

const steps = (messages: Messages) => {
  const t = ((key: string) => {
    const [group, name] = key.split('.');
    return messages.Tour[group][name];
  }) as Parameters<typeof DASHBOARD_STEPS>[0];
  return DASHBOARD_STEPS(t);
};

describe('visite guidée de l\'écran Aujourd\'hui', () => {
  it('pointe la barre des soldes, Budgets, À traiter puis Nouvelle opération', () => {
    expect(steps(fr as unknown as Messages).map((s) => s.target)).toEqual([
      'body',
      '[data-tour="stats"]',
      '[data-tour="budget-breakdown"]',
      '[data-tour="to-handle"]',
      '[data-tour="add-transaction"]',
    ]);
  });

  it('sur mobile, ne pointe aucun bloc masqué : Budgets à surveiller et le « + » de la barre', () => {
    const t = ((key: string) => key) as Parameters<typeof DASHBOARD_STEPS>[0];
    expect(DASHBOARD_STEPS(t, false).map((s) => s.target)).toEqual([
      'body',
      '[data-tour="stats"]',
      '[data-tour="budgets-to-watch"]',
      '[data-tour="to-handle"]',
      '[data-tour="nav-add"]',
    ]);
  });

  it.each([
    ['français', fr],
    ['anglais', en],
  ] as const)('chaque étape a un texte (%s)', (_name, messages) => {
    for (const step of steps(messages as unknown as Messages)) {
      expect(typeof step.content).toBe('string');
      expect((step.content as string).length).toBeGreaterThan(10);
    }
  });

  it('annonce le prévu et les soldes, sans parler des dernières opérations (français)', () => {
    const [, stats, , todo] = steps(fr as unknown as Messages);
    expect(stats.content).toBe(
      'Votre solde prévu en fin de période, votre solde en banque et votre solde à venir, pour la période choisie.',
    );
    expect(String(todo.content)).not.toMatch(/dernières/i);
  });

  it('annonce le prévu et les soldes (anglais)', () => {
    const [, stats] = steps(en as unknown as Messages);
    expect(stats.content).toBe(
      'Your forecast balance at the end of the period, your bank balance and your upcoming balance, for the chosen period.',
    );
  });
});
