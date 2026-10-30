import { describe, expect, it } from 'vitest';
import fr from '../../messages/fr.json';
import en from '../../messages/en.json';

type Tree = { [key: string]: string | Tree };

function leafKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : leafKeys(value, `${prefix}${key}.`),
  );
}

describe('i18n catalogs', () => {
  const frKeys = leafKeys(fr as Tree).sort();
  const enKeys = leafKeys(en as Tree).sort();

  it('has every fr key in en', () => {
    expect(frKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it('has every en key in fr', () => {
    expect(enKeys.filter((k) => !frKeys.includes(k))).toEqual([]);
  });
});
