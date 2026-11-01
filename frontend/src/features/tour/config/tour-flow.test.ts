import { describe, expect, it } from 'vitest';
import { nextIndexOnMissingTarget } from './tour-flow';

describe('cible introuvable pendant une visite', () => {
  it('saute l’étape dans la visite du tableau de bord, en avant comme en arrière', () => {
    expect(nextIndexOnMissingTarget('dashboard', 1, 'next')).toBe(2);
    expect(nextIndexOnMissingTarget('dashboard', 2, 'prev')).toBe(1);
  });

  it('attend l’ouverture du panneau dans la visite « compte » (étapes 2 et 4), saute ailleurs', () => {
    expect(nextIndexOnMissingTarget('account', 2, 'next')).toBeNull();
    expect(nextIndexOnMissingTarget('account', 4, 'prev')).toBeNull();
    expect(nextIndexOnMissingTarget('account', 1, 'next')).toBe(2);
    expect(nextIndexOnMissingTarget('account', 5, 'next')).toBe(6);
  });

  it('attend l’ouverture du tiroir à l’étape 0 de la visite « transactions », saute ailleurs', () => {
    expect(nextIndexOnMissingTarget('transactions', 0, 'next')).toBeNull();
    expect(nextIndexOnMissingTarget('transactions', 3, 'next')).toBe(4);
  });
});
