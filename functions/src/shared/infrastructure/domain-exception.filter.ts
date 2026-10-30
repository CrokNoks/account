import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import {
  ConflictError,
  DomainError,
  DomainValidationError,
  ForbiddenError,
  NotFoundError,
} from '../domain/errors';

interface HttpResponseLike {
  status(code: number): { json(body: unknown): unknown };
}

function describe(error: DomainError): { status: number; label: string } {
  if (error instanceof NotFoundError)
    return { status: 404, label: 'Not Found' };
  if (error instanceof ForbiddenError)
    return { status: 403, label: 'Forbidden' };
  if (error instanceof ConflictError) return { status: 409, label: 'Conflict' };
  if (error instanceof DomainValidationError)
    return { status: 400, label: 'Bad Request' };
  // Erreur métier sans type précis : refus de la requête par prudence
  return { status: 400, label: 'Bad Request' };
}

/**
 * Traduit les erreurs métier en réponse HTTP au format Nest habituel.
 * Les autres erreurs (HttpException, erreurs techniques) ne sont pas capturées
 * et gardent le traitement par défaut de Nest (500 « Internal server error »).
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter<DomainError> {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    const { status, label } = describe(exception);
    response
      .status(status)
      .json({ statusCode: status, message: exception.message, error: label });
  }
}
