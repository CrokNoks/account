export interface DayGroup<T> {
  /** Jour calendaire AAAA-MM-JJ (date de l'opération lue en UTC). */
  date: string;
  rows: T[];
}

/**
 * Regroupe les opérations d'une page par jour calendaire, sans rien perdre, dupliquer ni réordonner :
 * les jours se suivent dans l'ordre de la page (du plus récent au plus ancien) et chaque jour garde
 * l'ordre de ses lignes. Le jour est lu en UTC (comme `formatShortDate`), jamais en heure locale.
 */
export function groupByDay<T extends { date: string }>(rows: T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const row of rows) {
    const day = row.date.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === day) last.rows.push(row);
    else groups.push({ date: day, rows: [row] });
  }
  return groups;
}
