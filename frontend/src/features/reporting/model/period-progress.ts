export interface PeriodProgress {
  /** Jour courant de la période, à partir de 1. */
  day: number;
  /** Nombre de jours de la période, bornes comprises. */
  total: number;
  /** Part de période écoulée, entre 0 et 1 (jour courant compris). */
  ratio: number;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;
const DAY_MS = 86_400_000;

function toDay(value: string | null | undefined): number | null {
  const m = value ? DATE_ONLY.exec(value) : null;
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS : null;
}

/**
 * « Jour X sur Y » d'une période, à partir de ses dates (jour calendaire, jamais le fuseau) et du jour local.
 * `null` si la période n'a pas de fin, est passée ou n'a pas commencé : rien à afficher.
 */
export function periodProgress(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: string,
): PeriodProgress | null {
  const start = toDay(startDate);
  const end = toDay(endDate);
  const now = toDay(today);
  if (start === null || end === null || now === null || end < start) return null;
  if (now < start || now > end) return null;
  const total = end - start + 1;
  const day = now - start + 1;
  return { day, total, ratio: day / total };
}
