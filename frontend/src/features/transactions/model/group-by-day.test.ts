import { describe, expect, it } from 'vitest';
import { groupByDay } from './group-by-day';

const tx = (id: string, date: string) => ({ id, date });

describe('groupByDay', () => {
  it('une page vide ne donne aucun groupe', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('regroupe par jour calendaire, jours dans l\'ordre de la page (récent -> ancien), ordre interne conservé', () => {
    const rows = [tx('a', '2026-11-06'), tx('b', '2026-11-06'), tx('c', '2026-11-05'), tx('d', '2026-11-03')];
    expect(groupByDay(rows)).toEqual([
      { date: '2026-11-06', rows: [rows[0], rows[1]] },
      { date: '2026-11-05', rows: [rows[2]] },
      { date: '2026-11-03', rows: [rows[3]] },
    ]);
  });

  it('lit la date en UTC : minuit UTC en bordure d\'année reste dans son jour, jamais décalé par le fuseau', () => {
    const rows = [tx('a', '2026-01-01T00:00:00.000Z'), tx('b', '2025-12-31T23:59:59.000Z'), tx('c', '2025-12-31T00:00:00.000Z')];
    const groups = groupByDay(rows);
    expect(groups.map((g) => g.date)).toEqual(['2026-01-01', '2025-12-31']);
    expect(groups[1].rows).toEqual([rows[1], rows[2]]);
  });

  it('ne perd ni ne duplique aucune opération', () => {
    const rows = Array.from({ length: 25 }, (_, i) => tx(`t${i}`, `2026-11-${String(25 - Math.floor(i / 3)).padStart(2, '0')}`));
    const groups = groupByDay(rows);
    expect(groups.flatMap((g) => g.rows).map((r) => r.id)).toEqual(rows.map((r) => r.id));
  });

  it('un jour coupé entre deux pages : chaque page a son propre groupe pour ce jour', () => {
    const page1 = groupByDay([tx('a', '2026-11-06'), tx('b', '2026-11-05')]);
    const page2 = groupByDay([tx('c', '2026-11-05'), tx('d', '2026-11-04')]);
    expect(page1[page1.length - 1].date).toBe('2026-11-05');
    expect(page2[0].date).toBe('2026-11-05');
  });

  it('un jour qui revient plus loin dans la page reste un groupe distinct (pas de réordonnancement)', () => {
    const groups = groupByDay([tx('a', '2026-11-06'), tx('b', '2026-11-05'), tx('c', '2026-11-06')]);
    expect(groups.map((g) => g.date)).toEqual(['2026-11-06', '2026-11-05', '2026-11-06']);
  });
});
