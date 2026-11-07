import { describe, expect, it } from 'vitest';
import { accountDialogAction, nextIndexOnMissingTarget } from './tour-flow';
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

describe('dialogue de création de compte dans la visite « compte »', () => {
  it('bureau : ouvert en sortant de l\'étape 1, fermé en sortant de la 4, rouvert au retour de la 5', () => {
    expect(accountDialogAction(1, 'next', true)).toBe('open');
    expect(accountDialogAction(2, 'prev', true)).toBe('close');
    expect(accountDialogAction(4, 'next', true)).toBe('close');
    expect(accountDialogAction(5, 'prev', true)).toBe('open');
    expect(accountDialogAction(3, 'next', true)).toBeNull();
  });

  it('mobile : fermé dès la sortie de l\'étape 3 (solde), avant l\'étape « Plus »', () => {
    expect(accountDialogAction(1, 'next', false)).toBe('open');
    expect(accountDialogAction(2, 'prev', false)).toBe('close');
    expect(accountDialogAction(3, 'next', false)).toBe('close');
    expect(accountDialogAction(4, 'prev', false)).toBe('open');
    expect(accountDialogAction(4, 'next', false)).toBeNull();
  });
});

describe('étapes de la visite « compte » sur mobile', () => {
  const t = ((k: string) => k) as never;

  it('remplace Réglages et Budgets (barre latérale masquée) par une étape « Plus »', () => {
    const mobile = ACCOUNT_STEPS(t, false);
    expect(mobile).toHaveLength(5);
    expect(mobile.map((s) => s.target).slice(3)).toEqual(['[data-tour="account-balance"]', '[data-tour="nav-more"]']);
    expect(mobile.some((s) => String(s.target).includes('nav-settings') || String(s.target).includes('nav-budgets'))).toBe(false);
  });

  it('laisse la visite du bureau inchangée', () => {
    expect(ACCOUNT_STEPS(t).map((s) => s.target).slice(4)).toEqual(['[data-tour="nav-settings"]', '[data-tour="nav-budgets"]']);
  });
});
