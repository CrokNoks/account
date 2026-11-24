import { describe, expect, it } from 'vitest';
import { presentUnallocated, unallocated } from './unallocated';

const nbsp = (s: string) => s.replace(/[  ]/g, ' ');

describe('Non réparti = Revenus prévus - Total budgété (centimes entiers)', () => {
  it('positif : 3 200,00 - 2 410,00 = 790,00, en encre et sans « + »', () => {
    expect(unallocated('320000', '241000')).toBe(BigInt(79000));
    const p = presentUnallocated('320000', '241000', 'fr')!;
    expect(nbsp(p.text)).toBe('790,00 €');
    expect(p.tone).toBe('ink');
  });

  it('zéro : 0,00 en encre', () => {
    const p = presentUnallocated('241000', '241000', 'fr')!;
    expect(nbsp(p.text)).toBe('0,00 €');
    expect(p.tone).toBe('ink');
  });

  it('négatif : écrit avec son « - » et orange', () => {
    const p = presentUnallocated('200000', '241000', 'fr')!;
    expect(nbsp(p.text)).toBe('-410,00 €');
    expect(p.tone).toBe('warn');
  });

  it('exact au-delà de 2^53 (bigint, pas de flottant)', () => {
    // 2^53 + 1 = 9007199254740993 : un flottant l'arrondirait à ...992
    const p = presentUnallocated('9007199254740993', '1', 'fr')!;
    expect(unallocated('9007199254740993', '1')).toBe(BigInt('9007199254740992'));
    expect(nbsp(p.text)).toBe('90 071 992 547 409,92 €');
    expect(nbsp(presentUnallocated('9007199254740993', '9007199254740995', 'fr')!.text)).toBe('-0,02 €');
  });

  it('même écriture que les deux cartes (anglais compris)', () => {
    expect(presentUnallocated('250000', '70000', 'en')!.text).toBe('€1,800.00');
  });

  it('indisponible si un des deux montants manque : pas de faux 0,00', () => {
    expect(presentUnallocated(undefined, '70000', 'fr')).toBeNull();
    expect(presentUnallocated('250000', undefined, 'fr')).toBeNull();
  });
});
