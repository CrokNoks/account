import {
  addDaysDateOnly,
  addMonthsDateOnly,
  toDateOnly,
} from '../../shared/domain/date-only';
import { recurringOccurrences } from '../../shared/domain/recurring-day';
import {
  Comparable,
  daysBetween,
  EQUIVALENT_DAYS,
  isEquivalent,
} from '../../shared/domain/recurring-equivalence';

/**
 * Bascule de période déclenchée par une transaction « paie » (catégorie
 * déclencheuse du compte) : fonction PURE, sans entrée/sortie. Elle décide
 * seulement ; l'écriture atomique est faite par `apply_period_switches` (SQL).
 *
 * Règles (spec `declencheur-periode`, CA2 à CA5 et CA8) :
 * - une bascule exige une déclencheuse non `pending`, datée d'aujourd'hui ou du
 *   passé, une période active, et un écart d'au moins 15 jours avec le début
 *   de l'active (14 : rien ; 15 : bascule ; date <= début : rien) ;
 * - l'active est close la veille de la date, la nouvelle commence à la date ;
 * - une déclencheuse de montant <= 0 ne bascule pas (`non_positive`, après `threshold`) ;
 * - paie déclenchante (`findTriggerSalary`) : la récurrente du lien
 *   `recurringId`, sinon l'équivalente à 7 jours au plus, sinon aucune ;
 * - règle A : la nouvelle période finit la veille de la prochaine occurrence
 *   de la paie déclenchante (à défaut de toutes les paies : la plus proche), à au
 *   moins 15 jours du début ; à défaut début + 1 mois - 1 jour ;
 *   cette occurrence est créée en `pending` le lendemain de la fin ;
 * - règle (c) : « déjà présente » se compare sur l'échéance d'origine
 *   (`dueDate`, sinon la date) ; règle (d) : seule la paie déclenchante n'est
 *   pas injectée à moins de 15 jours du début ;
 * - un lot est simulé dans l'ordre des dates : l'active simulée devient la
 *   nouvelle période, le seuil se mesure à son début, et seule la dernière
 *   bascule garde sa prochaine paie.
 */

/** Écart minimal, en jours, entre la déclencheuse et le début de l'active. */
export const SWITCH_THRESHOLD_DAYS = 15;

export type SkipReason =
  | 'not_trigger'
  | 'pending'
  | 'future'
  | 'no_active'
  | 'threshold'
  | 'non_positive';

export interface SwitchRecurring {
  id: string;
  categoryId: string | null;
  description: string;
  amount: bigint;
  dayOfMonth: number;
}

/** Transaction déjà en base issue d'une récurrente (`metadata.recurringId`). */
export interface ExistingRecurringTx {
  id: string;
  recurringId: string;
  date: Date;
  /** Échéance d'origine (`metadata.dueDate`) ; absente : on lit `date`. */
  dueDate?: Date;
  pending: boolean;
  /** Utiles au nettoyage de l'import (équivalence avec une ligne importée). */
  categoryId?: string | null;
  amount?: bigint;
}

/** Ligne de l'import, état FINAL : sert au nettoyage des `pending` équivalentes. */
export interface ImportedLine {
  id: string;
  date: Date;
  pending: boolean;
  categoryId: string | null;
  amount: bigint;
}

/** Transaction candidate : date et état `pending` FINAUX (après réécriture de la date). */
export interface SwitchTrigger {
  id: string;
  date: Date;
  pending: boolean;
  categoryId: string | null;
  /** Centimes : une déclencheuse de montant <= 0 ne bascule pas. */
  amount: bigint;
  /** `metadata.recurringId` : la paie qui a déclenché, si elle vient d'une récurrente. */
  recurringId?: string;
}

export interface PlanInput {
  triggerCategoryId: string;
  triggers: SwitchTrigger[];
  active: { id: string; start: Date } | null;
  /** Aujourd'hui, date calendaire du fuseau métier. */
  today: Date;
  recurring: SwitchRecurring[];
  existing: ExistingRecurringTx[];
  newId: () => string;
  /**
   * Lignes d'un import (absent : saisie, sortie du pending). Active le nettoyage :
   * pas de récurrente injectée dans les périodes intermédiaires, suppression des
   * `pending` récurrentes équivalentes, occurrence déjà importée non créée.
   */
  importLines?: ImportedLine[];
}

export interface PlannedOccurrence {
  recurringId: string;
  categoryId: string | null;
  description: string;
  amount: bigint;
  date: Date;
  /** Échéance d'origine (= `date` pour une injection ou la prochaine paie). */
  dueDate: Date;
}

export interface PeriodWindow {
  id: string;
  start: Date;
  end: Date;
}

export interface PlannedSwitch {
  triggerId: string;
  closed: PeriodWindow;
  opened: PeriodWindow;
  injected: PlannedOccurrence[];
  nextPaie: PlannedOccurrence | null;
}

export interface SkippedTrigger {
  triggerId: string;
  reason: SkipReason;
  /** Écart en jours avec le début de l'active ; null s'il n'est pas défini. */
  gapDays: number | null;
}

export interface PeriodSwitchPlan {
  switches: PlannedSwitch[];
  skipped: SkippedTrigger[];
  /** Fenêtres contiguës de l'ancienne active et des périodes ouvertes (fins définitives). */
  windows: PeriodWindow[];
  /** Import avec bascule : `pending` récurrentes à supprimer (équivalent déjà importé). */
  removedPendingIds: string[];
  /** Import avec bascule : récurrentes encore `pending` datées dans la période close. */
  remainingPending: number;
}

export { EQUIVALENT_DAYS };

const abs = (n: bigint) => (n < 0n ? -n : n);

/** Meilleur candidat : montant le plus proche, puis date la plus proche, puis id (déterministe). */
function pickBest<T extends Comparable & { id?: string }>(
  target: Comparable,
  candidates: T[],
): T | null {
  let best: T | null = null;
  let bestKey: [bigint, number, string] | null = null;
  for (const c of candidates) {
    const key: [bigint, number, string] = [
      abs(c.amount - target.amount),
      Math.abs(daysBetween(c.date, target.date)),
      c.id ?? '',
    ];
    if (
      !bestKey ||
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] &&
        (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))
    ) {
      best = c;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Paie qui a déclenché la bascule : (i) la récurrente du lien `recurringId` si
 * c'est une paie ; (ii) sinon celle dont l'occurrence la plus proche de la date
 * de la déclencheuse est à 7 jours au plus (la plus proche, puis id) ; (iii)
 * sinon `null` (comportement d'avant : toutes les paies).
 */
export function findTriggerSalary(
  trigger: Pick<SwitchTrigger, 'date' | 'recurringId'>,
  salaries: SwitchRecurring[],
): SwitchRecurring | null {
  if (trigger.recurringId) {
    const linked = salaries.find((s) => s.id === trigger.recurringId);
    if (linked) return linked;
  }
  let best: { salary: SwitchRecurring; gap: number } | null = null;
  for (const salary of salaries) {
    const occurrences = recurringOccurrences(
      salary.dayOfMonth,
      addDaysDateOnly(trigger.date, -EQUIVALENT_DAYS),
      addDaysDateOnly(trigger.date, EQUIVALENT_DAYS),
    );
    for (const occurrence of occurrences) {
      const gap = Math.abs(daysBetween(trigger.date, occurrence));
      if (
        !best ||
        gap < best.gap ||
        (gap === best.gap && salary.id < best.salary.id)
      ) {
        best = { salary, gap };
      }
    }
  }
  return best ? best.salary : null;
}

function monthKey(date: Date): string {
  return toDateOnly(date).slice(0, 7);
}

/** Id de la période dont la fenêtre contient `date`, sinon null. */
export function periodIdOnDate(
  windows: PeriodWindow[],
  date: Date,
): string | null {
  const found = windows.find((w) => date >= w.start && date <= w.end);
  return found ? found.id : null;
}

interface Pass {
  newId: () => string;
  /** Index de la dernière bascule (import) : les autres n'injectent rien. */
  lastIndex: number | null;
  /** `pending` supprimées : ne comptent plus pour la prochaine paie (b), restent « déjà présentes » pour (c). */
  removed: Set<string>;
  /** Vrai si une ligne importée non appariée est l'équivalent de l'occurrence (elle est alors consommée). */
  alreadyImported: (occurrence: Comparable) => boolean;
}

export function planPeriodSwitches(input: PlanInput): PeriodSwitchPlan {
  // Ids des périodes ouvertes : les mêmes d'une simulation à l'autre.
  const cache: string[] = [];
  const idGenerator = () => {
    let n = 0;
    return () => {
      cache[n] ??= input.newId();
      return cache[n++];
    };
  };
  const stableInput = input;
  const first = simulate(stableInput, {
    newId: idGenerator(),
    lastIndex: null,
    removed: new Set(),
    alreadyImported: () => false,
  });
  const lines = input.importLines;
  if (!lines || first.switches.length === 0) return first;

  // Nettoyage de l'import : décidé ici, appliqué par une seconde simulation.
  const lineIds = new Set(lines.map((l) => l.id));
  const firstCloseEnd = first.switches[0].closed.end;
  const activeStart = input.active!.start;
  const unmatched = lines
    .filter((l) => !l.pending)
    .sort(
      (a, b) => a.date.getTime() - b.date.getTime() || (a.id < b.id ? -1 : 1),
    );
  const candidates = input.existing
    .filter(
      (e) =>
        e.pending &&
        !lineIds.has(e.id) &&
        e.categoryId != null &&
        e.amount !== undefined &&
        e.date >= activeStart,
    )
    .map((e) => ({
      id: e.id,
      categoryId: e.categoryId,
      amount: e.amount!,
      date: e.date,
    }));
  const removed = new Set<string>();
  const stillUnmatched: ImportedLine[] = [];
  for (const line of unmatched) {
    const pool = candidates.filter(
      (c) =>
        !removed.has(c.id) &&
        (c.date <= firstCloseEnd ||
          (c.categoryId === input.triggerCategoryId &&
            c.date <= addDaysDateOnly(line.date, EQUIVALENT_DAYS))) &&
        isEquivalent(c, line),
    );
    const match = pickBest(line, pool);
    if (match) removed.add(match.id);
    else stillUnmatched.push(line);
  }
  const remainingPending = input.existing.filter(
    (e) =>
      e.pending &&
      !lineIds.has(e.id) &&
      !removed.has(e.id) &&
      e.date >= activeStart &&
      e.date <= firstCloseEnd,
  ).length;

  const result = simulate(stableInput, {
    newId: idGenerator(),
    lastIndex: first.switches.length - 1,
    removed,
    alreadyImported: (occurrence) => {
      const line = pickBest(
        occurrence,
        stillUnmatched.filter((l) => isEquivalent(occurrence, l)),
      );
      if (!line) return false;
      stillUnmatched.splice(stillUnmatched.indexOf(line), 1);
      return true;
    },
  });
  return {
    ...result,
    removedPendingIds: [...removed].sort(),
    remainingPending,
  };
}

function simulate(input: PlanInput, pass: Pass): PeriodSwitchPlan {
  const { triggerCategoryId, today, recurring } = input;
  const newId = pass.newId;
  const salaries = recurring.filter(
    (r) => r.categoryId === triggerCategoryId && r.amount > 0n,
  );
  const sorted = [...input.triggers].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const switches: PlannedSwitch[] = [];
  const skipped: SkippedTrigger[] = [];
  // Transactions de récurrentes connues : celles de la base puis celles planifiées.
  const known: ExistingRecurringTx[] = [...input.existing];
  let simulated = input.active;

  for (const t of sorted) {
    const gap = simulated ? daysBetween(simulated.start, t.date) : null;
    const reason: SkipReason | null =
      t.categoryId !== triggerCategoryId
        ? 'not_trigger'
        : t.pending
          ? 'pending'
          : t.date > today
            ? 'future'
            : !simulated
              ? 'no_active'
              : gap !== null && gap < SWITCH_THRESHOLD_DAYS
                ? 'threshold'
                : t.amount <= 0n
                  ? 'non_positive'
                  : null;
    if (reason !== null || !simulated) {
      skipped.push({
        triggerId: t.id,
        reason: reason ?? 'no_active',
        gapDays: gap,
      });
      continue;
    }

    const newStart = t.date;
    const closeEnd = addDaysDateOnly(newStart, -1);
    const farEnough = addDaysDateOnly(newStart, SWITCH_THRESHOLD_DAYS);
    const lookAheadEnd = addMonthsDateOnly(farEnough, 2);
    // Les autres lignes du compte, sans la déclencheuse elle-même (jamais un doublon d'elle-même).
    const others = known.filter((e) => e.id !== t.id);

    // Paie déclenchante : seule à fixer la fin (A) et à ne pas être injectée à < 15 jours (d).
    const triggerSalary = findTriggerSalary(t, salaries);

    // (a) prochaine paie : première occurrence >= début + 15 j (la paie déclenchante,
    // à défaut la plus proche de toutes).
    let next: { salary: SwitchRecurring; date: Date } | null = null;
    for (const salary of triggerSalary ? [triggerSalary] : salaries) {
      const [first] = recurringOccurrences(
        salary.dayOfMonth,
        farEnough,
        lookAheadEnd,
      );
      if (first && (!next || first < next.date)) next = { salary, date: first };
    }
    const newEnd = next
      ? addDaysDateOnly(next.date, -1)
      : addDaysDateOnly(addMonthsDateOnly(newStart, 1), -1);

    // Injection (c) et (d) : une occurrence par mois civil et par récurrente,
    // jamais une paie à moins de 15 jours du début.
    const injected: PlannedOccurrence[] = [];
    // Import : seule la dernière bascule injecte (les périodes intermédiaires restent vides).
    const mayInject = !input.importLines || switches.length === pass.lastIndex;
    for (const rec of mayInject ? recurring : []) {
      const isSalary = triggerSalary
        ? rec.id === triggerSalary.id
        : salaries.includes(rec);
      for (const date of recurringOccurrences(
        rec.dayOfMonth,
        newStart,
        newEnd,
      )) {
        if (isSalary && daysBetween(newStart, date) < SWITCH_THRESHOLD_DAYS)
          continue;
        const present = [...others, ...injectedAsKnown(injected)].some(
          (e) =>
            e.recurringId === rec.id &&
            monthKey(e.dueDate ?? e.date) === monthKey(date),
        );
        if (present) continue;
        if (
          pass.lastIndex !== null &&
          pass.alreadyImported({
            categoryId: rec.categoryId,
            amount: rec.amount,
            date,
          })
        )
          continue;
        injected.push({
          recurringId: rec.id,
          categoryId: rec.categoryId,
          description: rec.description,
          amount: rec.amount,
          date,
          dueDate: date,
        });
      }
    }
    injected.sort((a, b) => a.date.getTime() - b.date.getTime());

    // (b) la prochaine paie existe une seule fois en `pending` (précision après le canard).
    let nextPaie: PlannedOccurrence | null = null;
    if (next) {
      const duplicate = others.some(
        (e) =>
          !pass.removed.has(e.id) &&
          e.recurringId === next.salary.id &&
          e.pending &&
          daysBetween(newStart, e.date) >= SWITCH_THRESHOLD_DAYS,
      );
      if (!duplicate) {
        nextPaie = {
          recurringId: next.salary.id,
          categoryId: next.salary.categoryId,
          description: next.salary.description,
          amount: next.salary.amount,
          date: next.date,
          dueDate: next.date,
        };
      }
    }

    // La déclencheuse suivante du lot réécrit la fin de la période simulée.
    const previous = switches[switches.length - 1];
    if (previous && previous.opened.id === simulated.id) {
      previous.opened.end = closeEnd;
    }

    const opened: PeriodWindow = { id: newId(), start: newStart, end: newEnd };
    switches.push({
      triggerId: t.id,
      closed: { id: simulated.id, start: simulated.start, end: closeEnd },
      opened,
      injected,
      nextPaie,
    });
    known.push(...injectedAsKnown(injected));
    simulated = { id: opened.id, start: newStart };
  }

  // Seule la dernière bascule d'un lot crée la prochaine paie.
  for (const sw of switches.slice(0, -1)) sw.nextPaie = null;

  const windows: PeriodWindow[] = [];
  if (switches.length > 0 && input.active) {
    windows.push({
      id: input.active.id,
      start: input.active.start,
      end: switches[0].closed.end,
    });
    windows.push(...switches.map((s) => s.opened));
  }
  return {
    switches,
    skipped,
    windows,
    removedPendingIds: [],
    remainingPending: 0,
  };
}

function injectedAsKnown(injected: PlannedOccurrence[]): ExistingRecurringTx[] {
  return injected.map((o) => ({
    id: `planned:${o.recurringId}:${toDateOnly(o.date)}`,
    recurringId: o.recurringId,
    date: o.date,
    dueDate: o.dueDate,
    pending: true,
  }));
}
