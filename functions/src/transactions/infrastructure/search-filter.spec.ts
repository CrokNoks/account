import { buildSearchFilter } from './search-filter';

const filterOf = (pattern: string) =>
  `description.imatch."${pattern}",notes.imatch."${pattern}"`;

describe('buildSearchFilter', () => {
  it('cherche la saisie comme sous-chaîne, entre guillemets PostgREST', () => {
    expect(buildSearchFilter('carrefour')).toBe(filterOf('carrefour'));
  });

  it('garde virgule et parenthèses dans la valeur (pas de condition ajoutée)', () => {
    expect(buildSearchFilter('x,amount.gt.0')).toBe(
      filterOf('x,amount\\\\.gt\\\\.0'),
    );
    expect(buildSearchFilter('(test)')).toBe(filterOf('\\\\(test\\\\)'));
  });

  it('neutralise les caractères spéciaux de regex dont * (pas de joker)', () => {
    expect(buildSearchFilter('2*3')).toBe(filterOf('2\\\\*3'));
    expect(buildSearchFilter('100%')).toBe(filterOf('100%'));
    expect(buildSearchFilter('a_b')).toBe(filterOf('a_b'));
  });

  it('échappe le guillemet et l’antislash', () => {
    expect(buildSearchFilter('dit "oui"')).toBe(filterOf('dit \\"oui\\"'));
    expect(buildSearchFilter('c:\\temp')).toBe(filterOf('c:\\\\\\\\temp'));
  });
});
