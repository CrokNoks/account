/**
 * Échéance d'origine d'une transaction issue d'une récurrente : `metadata.dueDate`
 * (`YYYY-MM-DD`). Elle reste la date prévue même quand la transaction est
 * redatée (pointage, modification). Posée à l'injection (création de période,
 * bascule), jamais à la saisie ni à l'import.
 */

import { toDateOnly } from './date-only';

const DUE_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lit `metadata.dueDate`. Format `YYYY-MM-DD` strict et date réelle, sinon
 * `undefined` (valeur absente ou invalide : jamais d'erreur).
 */
export function readDueDate(metadata: unknown): Date | undefined {
  if (typeof metadata !== 'object' || metadata === null) return undefined;
  const value = (metadata as Record<string, unknown>).dueDate;
  if (typeof value !== 'string' || !DUE_DATE_FORMAT.test(value)) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || toDateOnly(date) !== value) {
    return undefined;
  }
  return date;
}

/** Fragment de `metadata` portant l'échéance d'origine. */
export function dueDateMetadata(date: Date): { dueDate: string } {
  return { dueDate: toDateOnly(date) };
}

/** Lit `metadata.recurringId` (chaîne non vide), sinon `undefined`. */
export function readRecurringId(metadata: unknown): string | undefined {
  if (typeof metadata !== 'object' || metadata === null) return undefined;
  const value = (metadata as Record<string, unknown>).recurringId;
  return typeof value === 'string' && value !== '' ? value : undefined;
}
