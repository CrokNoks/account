import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Journalise chaque refus 400 (validation, identifiant invalide) : méthode, route (gabarit,
 * sans identifiants ni query) et messages de validation. Jamais le corps de la requête :
 * les messages ne contiennent que des noms de champs et des contraintes, pas les valeurs
 * (libellés bancaires). La réponse reste celle de Nest par défaut.
 */
@Catch(BadRequestException)
export class ValidationLogFilter implements ExceptionFilter {
  private readonly logger = new Logger('Validation');

  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const body = exception.getResponse();
    const message =
      typeof body === 'object' ? (body as { message?: unknown }).message : body;
    const messages = Array.isArray(message) ? message.join(' | ') : message;

    this.logger.warn(
      `400 ${req.method} ${(req.route as { path?: string } | undefined)?.path ?? 'unknown route'}: ${String(messages)}`,
    );
    res.status(exception.getStatus()).json(body);
  }
}

/** Filtres globaux de l'application (partagés par main.ts et les tests e2e). */
export const globalFilters = () => [new ValidationLogFilter()];
