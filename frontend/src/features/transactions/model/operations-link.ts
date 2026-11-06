/**
 * Liens vers l'écran Opérations (depuis À traiter) : les filtres voyagent dans l'URL.
 * `ids` : identifiants séparés par des virgules (filtre du back, appliqué aux seules transactions du compte) ;
 * `period=all` : toutes les périodes ; `categoryId` ; `state=a_pointer` (filtre d'état).
 */
export interface OperationsLink {
  ids?: string[];
  categoryId?: string;
  state?: 'a_pointer';
  allPeriods?: boolean;
}

export function operationsHref({ ids, categoryId, state, allPeriods }: OperationsLink = {}): string {
  const params = new URLSearchParams();
  if (ids && ids.length > 0) params.set('ids', ids.join(','));
  if (categoryId) params.set('categoryId', categoryId);
  if (state) params.set('state', state);
  if (allPeriods) params.set('period', 'all');
  const query = params.toString();
  return query ? `/transactions?${query}` : '/transactions';
}

export interface OperationsLinkFilters {
  ids: string[];
  categoryId: string | undefined;
  state: 'a_pointer' | undefined;
  allPeriods: boolean;
}

/** Relit les filtres d'un lien (l'inverse de `operationsHref`) ; les identifiants sont validés par le back. */
export function readOperationsLink(params: { get: (name: string) => string | null }): OperationsLinkFilters {
  const ids = (params.get('ids') ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  return {
    ids,
    categoryId: params.get('categoryId') || undefined,
    state: params.get('state') === 'a_pointer' ? 'a_pointer' : undefined,
    allPeriods: params.get('period') === 'all',
  };
}
