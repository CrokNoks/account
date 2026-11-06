import { CategoryType } from '../../categories/domain/category.entity';
import { buildSpendingPace, PaceTransaction } from './spending-pace';

const types = new Map<string, CategoryType>([
  ['dep', CategoryType.EXPENSE],
  ['dep2', CategoryType.EXPENSE],
  ['epa', CategoryType.SAVINGS],
  ['rev', CategoryType.INCOME],
  ['vir', CategoryType.TRANSFER],
]);
const start = new Date('2026-11-01');
const t = (
  day: number,
  amount: number,
  categoryId: string | null,
  pending = false,
): PaceTransaction => ({
  date: new Date(Date.UTC(2026, 10, day)),
  amount: BigInt(amount),
  categoryId,
  pending,
});
const run = (txs: PaceTransaction[], days = 10) =>
  buildSpendingPace({
    start,
    days,
    transactions: txs,
    categoryTypes: types,
    previous: null,
  });
const cums = (r: ReturnType<typeof run>) => r.points.map((p) => p.cumulative);

describe('buildSpendingPace', () => {
  it('cumule par jour, plateaux inclus', () => {
    const r = run([t(1, -1000, 'dep'), t(3, -500, 'dep')]);
    expect(cums(r)).toEqual([
      1000n,
      1000n,
      1500n,
      1500n,
      1500n,
      1500n,
      1500n,
      1500n,
      1500n,
      1500n,
    ]);
    expect(r.points).toHaveLength(10);
    expect(r.points[0]).toMatchObject({ day: 1, date: '2026-11-01' });
    expect(r.points[9]).toMatchObject({ day: 10, date: '2026-11-10' });
  });

  it("compte l'épargne", () => {
    expect(cums(run([t(2, -2000, 'epa')]))[1]).toBe(2000n);
  });

  it('exclut revenus, virements catégorisés et revenus négatifs', () => {
    const r = run([t(1, 5000, 'rev'), t(1, -3000, 'vir'), t(2, -2000, 'rev')]);
    expect(cums(r).every((c) => c === 0n)).toBe(true);
  });

  it('compte une sortie sans catégorie, exclut un remboursement sans catégorie', () => {
    const r = run([t(1, -700, null), t(1, 900, null)]);
    expect(cums(r)[0]).toBe(700n);
  });

  it('net de catégorie : dépense puis remboursement', () => {
    const r = run([t(1, -1000, 'dep'), t(2, 300, 'dep')]);
    expect(cums(r)[1]).toBe(700n);
  });

  it('peut baisser un jour de remboursement', () => {
    const r = run([t(1, -1000, 'dep'), t(2, 300, 'dep')]);
    expect(cums(r).slice(0, 2)).toEqual([1000n, 700n]);
  });

  it('exclut les pending', () => {
    expect(cums(run([t(1, -4000, 'dep', true)]))[0]).toBe(0n);
  });

  it('ignore catégorie inconnue et transactions hors fenêtre', () => {
    const r = run([
      t(1, -100, 'inconnue'),
      t(15, -999, 'dep'),
      t(1, -50, 'dep'),
    ]);
    expect(cums(r)[9]).toBe(50n);
    expect(r.points).toHaveLength(10);
  });

  it('sans précédente : previousCumulative null et gap null', () => {
    const r = run([t(1, -100, 'dep')]);
    expect(r.points.every((p) => p.previousCumulative === null)).toBe(true);
    expect(r.gap).toBeNull();
  });

  it('période démarrant demain : aucun point, gap null', () => {
    const r = run([], 0);
    expect(r.points).toEqual([]);
    expect(r.gap).toBeNull();
  });

  it('une seule journée : 1 point', () => {
    expect(run([t(1, -100, 'dep')], 1).points).toHaveLength(1);
  });

  describe('avec précédente', () => {
    const prev = (txs: PaceTransaction[], days: number) => ({
      start: new Date('2026-10-01'),
      days,
      transactions: txs,
    });
    const pt = (day: number, amount: number, categoryId: string | null) => ({
      date: new Date(Date.UTC(2026, 9, day)),
      amount: BigInt(amount),
      categoryId,
      pending: false,
    });
    const withPrev = (
      current: PaceTransaction[],
      p: ReturnType<typeof prev>,
      days = 10,
    ) =>
      buildSpendingPace({
        start,
        days,
        transactions: current,
        categoryTypes: types,
        previous: p,
      });

    it('lit la précédente au même jour, pas son total', () => {
      const r = withPrev(
        [t(1, -1000, 'dep')],
        prev([pt(5, -800, 'dep'), pt(20, -700, 'dep')], 31),
      );
      const pc = r.points.map((p) => p.previousCumulative);
      expect(pc.slice(0, 4)).toEqual([0n, 0n, 0n, 0n]);
      expect(pc.slice(4)).toEqual([800n, 800n, 800n, 800n, 800n, 800n]);
      expect(r.gap).toBe(1000n - 800n);
    });

    it('précédente plus courte : garde son cumul final au-delà', () => {
      const r = withPrev([], prev([pt(2, -500, 'dep')], 5), 8);
      expect(r.points.map((p) => p.previousCumulative)).toEqual([
        0n,
        500n,
        500n,
        500n,
        500n,
        500n,
        500n,
        500n,
      ]);
    });

    it('écart signé : plus puis moins', () => {
      expect(
        withPrev([t(1, -1500, 'dep')], prev([pt(1, -1000, 'dep')], 31)).gap,
      ).toBe(500n);
      expect(
        withPrev([t(1, -800, 'dep')], prev([pt(1, -1000, 'dep')], 31)).gap,
      ).toBe(-200n);
    });

    it('période vide avec précédente : écart = -précédente', () => {
      expect(withPrev([], prev([pt(1, -300, 'dep')], 31)).gap).toBe(-300n);
    });

    it('précédente de 0 jour : cumul 0', () => {
      const r = withPrev([t(1, -100, 'dep')], prev([], 0));
      expect(r.points.every((p) => p.previousCumulative === 0n)).toBe(true);
    });
  });
});
