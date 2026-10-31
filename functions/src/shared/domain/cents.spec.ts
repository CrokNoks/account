import { isCentsString, parseCents } from './cents';

describe('cents', () => {
  it.each([
    '0',
    '-0',
    '1250',
    '-4250',
    '9007199254740991',
    '-9007199254740991',
  ])('accepts %s', (value) => expect(isCentsString(value)).toBe(true));

  it.each([
    '',
    '12.5',
    '1e3',
    '+5',
    ' 5',
    '12 €',
    '9007199254740992',
    '-9007199254740992',
    '9223372036854775807',
    '-9223372036854775808',
    '99999999999999999999999',
  ])('refuses %j', (value) => expect(isCentsString(value)).toBe(false));

  it('refuses non strings', () => expect(isCentsString(5)).toBe(false));

  it('converts without losing precision', () => {
    expect(parseCents('9007199254740991').toString()).toBe('9007199254740991');
    expect(parseCents('-0')).toBe(BigInt(0));
  });
});
