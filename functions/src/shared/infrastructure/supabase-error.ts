import {
  ConflictError,
  DomainValidationError,
  ForbiddenError,
  NotFoundError,
} from '../domain/errors';

/** Forme minimale d'une erreur PostgREST / Postgres renvoyée par supabase-js. */
export interface SupabaseErrorLike {
  code?: string;
  message: string;
}

export interface SupabaseErrorContext {
  /** Message 409 propre à la contrainte (23505 unicité, 23P01 exclusion). Sans lui, l'erreur reste générique. */
  conflict?: string;
  /** Message 404 (P0002). */
  notFound?: string;
  /** Préfixe du message de l'erreur générique (journaux uniquement). */
  prefix?: string;
}

const RLS_VIOLATION = '42501';
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const EXCLUSION_VIOLATION = '23P01';
const NO_DATA_FOUND = 'P0002';

/**
 * Traduit une erreur d'écriture Supabase en erreur métier.
 * Toute autre erreur reste une Error générique (500, message non exposé).
 * À utiliser avec `throw toDomainError(error, ...)`.
 */
export function toDomainError(
  error: SupabaseErrorLike,
  context: SupabaseErrorContext = {},
): Error {
  switch (error.code) {
    case RLS_VIOLATION:
      return new ForbiddenError(
        'You do not have permission to modify this resource',
      );
    case UNIQUE_VIOLATION:
    case EXCLUSION_VIOLATION:
      if (context.conflict) return new ConflictError(context.conflict);
      break;
    case NO_DATA_FOUND:
      return new NotFoundError(context.notFound ?? 'Resource not found');
    case FOREIGN_KEY_VIOLATION:
      return new DomainValidationError('Referenced resource does not exist');
  }
  return new Error(`${context.prefix ?? ''}${error.message}`);
}
