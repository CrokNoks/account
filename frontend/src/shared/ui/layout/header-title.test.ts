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

  it('keeps the title of the other pages', () => {
    expect(headerTitleKey('/')).toBe('dashboard');
    expect(headerTitleKey('/en')).toBe('dashboard');
    expect(headerTitleKey('/transactions')).toBe('transactions');
    expect(headerTitleKey('/cashflow')).toBe('prevision');
  });

  it('knows every page of the sidebar', () => {
    expect(headerTitleKey('/calendar')).toBe('calendar');
    expect(headerTitleKey('/tags')).toBe('tags');
    expect(headerTitleKey('/smart-rules')).toBe('smart_rules');
    expect(headerTitleKey('/recurring')).toBe('recurring');
  });

  it('only returns keys that exist in both languages', () => {
    for (const path of ['/', '/calendar', '/evolution', '/flux', '/cashflow', '/accounts', '/categories', '/tags', '/smart-rules', '/recurring', '/budgets', '/transactions', '/transactions/import']) {
      const key = headerTitleKey(path) as keyof typeof fr.Navigation;
      expect(fr.Navigation[key], path).toBeTruthy();
      expect(en.Navigation[key], path).toBeTruthy();
    }
  });
});
