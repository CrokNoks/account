import { describe, expect, it } from 'vitest';
import { operationsHref, readOperationsLink } from './operations-link';

const read = (href: string) => readOperationsLink(new URL(href, 'http://x').searchParams);

describe('liens vers Opérations', () => {
  it('sans filtre : la liste simple', () => {
    expect(operationsHref()).toBe('/transactions');
  });

  it("anomalie : les identifiants exacts, toutes périodes, sans filtre d'état", () => {
    const href = operationsHref({ ids: ['a', 'b'], allPeriods: true });
    expect(read(href)).toEqual({ ids: ['a', 'b'], categoryId: undefined, allPeriods: true, idsMissing: false });
    expect(new URL(href, 'http://x').searchParams.get('state')).toBeNull();
  });

  it('dépassement : la catégorie, la période choisie reste celle de l\'écran', () => {
    expect(read(operationsHref({ categoryId: 'cat-1' }))).toEqual({ ids: [], categoryId: 'cat-1', allPeriods: false, idsMissing: false });
  });

  it('CB à pointer : le filtre d\'état', () => {
    expect(new URL(operationsHref({ state: 'a_pointer' }), 'http://x').searchParams.get('state')).toBe('a_pointer');
  });

  it("CB à pointer : le filtre d'état est relu", () => {
    expect(read(operationsHref({ state: 'a_pointer' })).state).toBe('a_pointer');
    expect(read('/transactions?state=n_importe_quoi').state).toBeUndefined();
  });

  it('anomalie sans identifiant : le lien le dit (ids vide), il ne devient pas la liste simple', () => {
    const href = operationsHref({ ids: [], allPeriods: true });
    expect(read(href).idsMissing).toBe(true);
    expect(read('/transactions?ids=').idsMissing).toBe(true);
    expect(read('/transactions?ids=,,').idsMissing).toBe(true);
    expect(read('/transactions').idsMissing).toBe(false);
    expect(read('/transactions?ids=a').idsMissing).toBe(false);
  });

  it('ignore les identifiants vides', () => {
    expect(read('/transactions?ids=,a,,b,').ids).toEqual(['a', 'b']);
  });
});
