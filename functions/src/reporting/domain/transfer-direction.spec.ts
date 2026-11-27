import { transferDirection } from './transfer-direction';

const B = (n: number) => BigInt(n);

describe('transferDirection', () => {
  it('un budget négatif est un virement sortant, quel que soit le réel', () => {
    expect(transferDirection(B(-203248), B(0))).toBe('outgoing');
    expect(transferDirection(B(-203248), B(-203248))).toBe('outgoing');
    expect(transferDirection(B(-203248), B(300))).toBe('outgoing');
  });

  it('un budget positif est un virement entrant, même si le réel est négatif (décision 1)', () => {
    expect(transferDirection(B(203300), B(0))).toBe('incoming');
    expect(transferDirection(B(203300), B(-5000))).toBe('incoming');
  });

  it('sans budget (0), le signe du réel donne le sens', () => {
    expect(transferDirection(B(0), B(-50000))).toBe('outgoing');
    expect(transferDirection(B(0), B(50000))).toBe('incoming');
  });

  it('sans budget ni opération : entrant', () => {
    expect(transferDirection(B(0), B(0))).toBe('incoming');
  });
});
