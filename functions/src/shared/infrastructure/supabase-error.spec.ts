import {
  ConflictError,
  DomainValidationError,
  ForbiddenError,
  NotFoundError,
} from '../domain/errors';
import { toDomainError } from './supabase-error';

describe('toDomainError', () => {
  it('42501 (RLS) -> ForbiddenError sans détail de policy', () => {
    const e = toDomainError({
      code: '42501',
      message: 'new row violates row-level security policy for table "x"',
    });
    expect(e).toBeInstanceOf(ForbiddenError);
    expect(e.message).toBe(
      'You do not have permission to modify this resource',
    );
  });

  it('23505 -> ConflictError avec le message fourni', () => {
    const e = toDomainError(
      { code: '23505', message: 'duplicate key' },
      { conflict: 'Already there' },
    );
    expect(e).toBeInstanceOf(ConflictError);
    expect(e.message).toBe('Already there');
  });

  it('23505 sans message fourni -> Error générique', () => {
    const e = toDomainError({ code: '23505', message: 'duplicate key' });
    expect(e).not.toBeInstanceOf(ConflictError);
    expect(e.message).toBe('duplicate key');
  });

  it('P0002 -> NotFoundError', () => {
    const e = toDomainError(
      { code: 'P0002', message: 'x' },
      { notFound: 'Transaction not found' },
    );
    expect(e).toBeInstanceOf(NotFoundError);
    expect(e.message).toBe('Transaction not found');
  });

  it('23503 -> DomainValidationError', () => {
    const e = toDomainError({ code: '23503', message: 'fk' });
    expect(e).toBeInstanceOf(DomainValidationError);
    expect(e.message).toBe('Referenced resource does not exist');
  });

  it('autre code -> Error générique avec préfixe', () => {
    const e = toDomainError(
      { code: 'XX000', message: 'boom' },
      { prefix: 'Failed: ' },
    );
    expect(e.constructor).toBe(Error);
    expect(e.message).toBe('Failed: boom');
  });
});
