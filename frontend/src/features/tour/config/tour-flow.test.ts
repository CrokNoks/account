import { describe, expect, it } from 'vitest';
import { nextIndexOnMissingTarget } from './tour-flow';
import { ACCOUNT_STEPS } from './account-tour';

describe('cible introuvable pendant une visite', () => {
  it('saute l’étape dans la visite du tableau de bord, en avant comme en arrière', () => {
    expect(nextIndexOnMissingTarget('dashboard', 1, 'next')).toBe(2);
    expect(nextIndexOnMissingTarget('dashboard', 2, 'prev')).toBe(1);
  });

  it('attend l’ouverture du panneau dans la visite « compte » (étape 2), saute ailleurs', () => {
    expect(nextIndexOnMissingTarget('account', 2, 'next')).toBeNull();
    // l'étape Réglages (4) cible la barre latérale, toujours rendue : pas d'attente
    expect(nextIndexOnMissingTarget('account', 4, 'next')).toBe(5);
    expect(nextIndexOnMissingTarget('account', 4, 'prev')).toBe(3);
    expect(nextIndexOnMissingTarget('account', 1, 'next')).toBe(2);
    expect(nextIndexOnMissingTarget('account', 5, 'next')).toBe(6);
    // la dernière étape (Budgets, index 5) termine la visite : 6 étapes
    expect(ACCOUNT_STEPS(((k: string) => k) as never)).toHaveLength(6);
  });

  it('attend l’ouverture du tiroir à l’étape 0 de la visite « transactions », saute ailleurs', () => {
    expect(nextIndexOnMissingTarget('transactions', 0, 'next')).toBeNull();
    expect(nextIndexOnMissingTarget('transactions', 3, 'next')).toBe(4);
  });
});
