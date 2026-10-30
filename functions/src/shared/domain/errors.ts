/**
 * Erreurs métier, sans dépendance au framework.
 * La traduction en code HTTP est faite par DomainExceptionFilter (infrastructure).
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Donnée invalide au regard des règles métier (→ 400). */
export class DomainValidationError extends DomainError {}

/** Ressource introuvable (→ 404). */
export class NotFoundError extends DomainError {}

/** Action interdite à l'appelant (→ 403). */
export class ForbiddenError extends DomainError {}

/** Conflit avec l'état actuel d'une ressource (→ 409). */
export class ConflictError extends DomainError {}
