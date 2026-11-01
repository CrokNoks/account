import { describe, expect, it } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { DASHBOARD_STEPS } from './dashboard-tour';

type Messages = { Tour: Record<string, Record<string, string>> };

const statsStepText = (messages: Messages) => {
  const t = ((key: string) => {
    const [group, name] = key.split('.');
    return messages.Tour[group][name];
  }) as Parameters<typeof DASHBOARD_STEPS>[0];
  const step = DASHBOARD_STEPS(t).find((s) => s.target === '[data-tour="stats"]');
  return step?.content;
};

describe('visite guidée du tableau de bord, étape stats', () => {
  it('annonce uniquement le solde en banque (français)', () => {
    expect(statsStepText(fr as unknown as Messages)).toBe(
      'Retrouvez ici votre solde en banque (opérations pointées) pour la période en cours.',
    );
  });

  it('annonce uniquement le solde en banque (anglais)', () => {
    expect(statsStepText(en as unknown as Messages)).toBe(
      'Find your bank balance (reconciled transactions) for the current period.',
    );
  });
});
