import { NotFoundError } from './errors';

/**
 * Règle d'accès unique pour les routes `/:accountId/.../:id` : l'élément doit
 * exister ET appartenir au compte de l'URL (un `accountId` absent, comme celui
 * d'une catégorie globale, n'appartient à aucun compte).
 *
 * Même erreur (404) dans les deux cas, pour ne pas révéler l'existence d'un
 * élément d'un autre compte.
 */
export function ensureBelongsToAccount<T extends { accountId?: string | null }>(
  item: T | null | undefined,
  accountId: string,
  label: string,
): T {
  if (!item || item.accountId !== accountId) {
    throw new NotFoundError(`${label} not found`);
  }
  return item;
}
