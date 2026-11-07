import { describe, expect, it } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { headerTitleKey } from './header-title';

describe('headerTitleKey', () => {
  it('gives the import page its own title', () => {
    expect(headerTitleKey('/transactions/import')).toBe('import');
    expect(headerTitleKey('/fr/transactions/import')).toBe('import');
    expect(headerTitleKey('/transactions/import/')).toBe('import');
  });

  it('uses the entry name for the 5 entries and Réglages', () => {
    expect(headerTitleKey('/')).toBe('today');
    expect(headerTitleKey('/en')).toBe('today');
    expect(headerTitleKey('/transactions')).toBe('operations');
    expect(headerTitleKey('/analyses')).toBe('analysis');
    expect(headerTitleKey('/budgets')).toBe('budgets');
    expect(headerTitleKey('/budgets/fixed')).toBe('budgets');
    expect(headerTitleKey('/echeances')).toBe('due_dates');
    expect(headerTitleKey('/settings')).toBe('settings');
  });

  it('titles « Échéances » the new screen and its two former addresses', () => {
    for (const path of ['/echeances', '/calendar', '/cashflow', '/fr/calendar', '/en/cashflow']) {
      expect(headerTitleKey(path), path).toBe('due_dates');
    }
    expect(fr.Navigation.due_dates).toBe('Échéances');
    expect(en.Navigation.due_dates).toBe('Due dates');
    expect('prevision' in fr.Navigation).toBe(false);
    expect('prevision' in en.Navigation).toBe(false);
  });

  it('uses the own name of an attached page', () => {
    expect(headerTitleKey('/accounts')).toBe('accounts');
    expect(headerTitleKey('/categories')).toBe('categories');
    expect(headerTitleKey('/tags')).toBe('tags');
    expect(headerTitleKey('/smart-rules')).toBe('smart_rules');
    expect(headerTitleKey('/recurring')).toBe('recurring');
  });

  it('titles « Analyses » the new screen and its three former addresses, with or without a language', () => {
    for (const path of ['/analyses', '/evolution', '/flux', '/depassements', '/fr/flux', '/en/depassements', '/en/evolution']) {
      expect(headerTitleKey(path), path).toBe('analysis');
    }
    expect(fr.Navigation.analysis).toBe('Analyses');
  });

  it('only returns keys that exist in both languages', () => {
    for (const path of ['/', '/settings', '/echeances', '/calendar', '/analyses', '/evolution', '/depassements', '/flux', '/cashflow', '/accounts', '/categories', '/tags', '/smart-rules', '/recurring', '/budgets', '/transactions', '/transactions/import']) {
      const key = headerTitleKey(path) as keyof typeof fr.Navigation;
      expect(fr.Navigation[key], path).toBeTruthy();
      expect(en.Navigation[key], path).toBeTruthy();
    }
  });
});
