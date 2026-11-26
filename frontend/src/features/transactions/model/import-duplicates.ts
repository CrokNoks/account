/**
 * Aide à la décision à l'étape de validation de l'import : repère les lignes du relevé déjà présentes
 * dans le compte (identiques) ou presque (proches). Fonctions pures : rien n'est refusé, tout est recochable.
 * Les jours se comparent tels quels (YYYY-MM-DD), sans fuseau, des deux côtés.
 */

/** Écart maximal (en jours) d'une ligne proche. */
export const NEAR_DAYS = 3;

export interface ImportRowToCompare {
  id: string;
  /** YYYY-MM-DD (ignorée si `invalid`). */
  date: string;
  description: string;
  /** Centimes entiers, en texte (même forme que l'API). */
  amount: string;
  /** Ligne illisible : jamais comparée. */
  invalid: boolean;
}

export interface ExistingTransaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  pending: boolean;
}

export interface FoundTransaction {
  date: string;
  description: string;
}

export interface ImportRowMark {
  duplicateOf?: FoundTransaction;
  nearOf?: FoundTransaction;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const MS_PER_DAY = 86_400_000;

/** Libellé comparé : espaces réduits, bords retirés, minuscules, accents retirés. Rien d'autre. */
export function comparableLabel(label: string): string {
  return label
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Numéro de jour calendaire (UTC, donc insensible au fuseau et à l'heure d'été) ; NaN si ce n'est pas une date. */
export function dayNumber(date: string): number {
  const m = DAY.exec(date);
  if (!m) return Number.NaN;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY);
}

function dayString(n: number): string {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Fenêtre de lecture de la base : première date − 3 jours à dernière date + 3 jours (lignes lisibles). */
export function windowForRows(rows: ImportRowToCompare[]): { startDate: string; endDate: string } | null {
  const days = rows.filter((r) => !r.invalid).map((r) => dayNumber(r.date)).filter((n) => !Number.isNaN(n));
  if (days.length === 0) return null;
  return {
    startDate: dayString(Math.min(...days) - NEAR_DAYS),
    endDate: dayString(Math.max(...days) + NEAR_DAYS),
  };
}

/**
 * Marques par id de ligne (les lignes sans marque sont absentes).
 * - identique : même jour, même montant, même libellé comparé. Chaque transaction de base ne « consomme »
 *   qu'une ligne, dans l'ordre du fichier ; les `pending` de la base sont ignorées.
 * - proche : même montant, 1 à 3 jours d'écart, parmi les transactions non consommées ; jamais pour une
 *   ligne déjà appariée à une identique.
 */
export function markImportRows(
  rows: ImportRowToCompare[],
  existing: ExistingTransaction[],
): Record<string, ImportRowMark> {
  const base = existing
    .filter((t) => !t.pending)
    .map((t) => ({ tx: t, day: dayNumber(t.date), label: comparableLabel(t.description), consumed: false }))
    .filter((t) => !Number.isNaN(t.day));
  const marks: Record<string, ImportRowMark> = {};
  const readable = rows
    .filter((r) => !r.invalid)
    .map((r) => ({ row: r, day: dayNumber(r.date), label: comparableLabel(r.description) }))
    .filter((r) => !Number.isNaN(r.day));

  for (const { row, day, label } of readable) {
    const found = base.find((t) => !t.consumed && t.day === day && t.tx.amount === row.amount && t.label === label);
    if (found) {
      found.consumed = true;
      marks[row.id] = { duplicateOf: { date: found.tx.date, description: found.tx.description } };
    }
  }

  for (const { row, day } of readable) {
    if (marks[row.id]) continue;
    let best: (typeof base)[number] | null = null;
    let bestGap = Infinity;
    for (const t of base) {
      const gap = Math.abs(t.day - day);
      if (t.consumed || t.tx.amount !== row.amount || gap < 1 || gap > NEAR_DAYS || gap >= bestGap) continue;
      best = t;
      bestGap = gap;
    }
    if (best) marks[row.id] = { nearOf: { date: best.tx.date, description: best.tx.description } };
  }
  return marks;
}
