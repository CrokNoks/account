/**
 * État d'une opération, défini ici une seule fois (étiquette, filtre, pointage).
 * Rapprochée → « pointee » (même si `pending`) ; sinon `pending` → « a_venir » ; sinon « a_pointer ».
 * Côté back, aucune définition d'état : il applique deux égalités indépendantes (`reconciled`, `pending`).
 */
export type OperationState = 'a_pointer' | 'a_venir' | 'pointee';
export type StateFilter = 'all' | OperationState;

export function operationState(t: { reconciled?: unknown; pending?: unknown }): OperationState {
  if (t.reconciled === true) return 'pointee';
  if (t.pending === true) return 'a_venir';
  return 'a_pointer';
}

/**
 * Paramètres de liste sélectionnant exactement les lignes d'un état.
 * « pointee » n'envoie pas `pending` : l'envoyer à faux exclurait la pending rapprochée.
 * « a_venir » envoie `reconciled: false` : sinon la pending rapprochée y serait comptée.
 */
export function stateFilterToQuery(filter: StateFilter): { reconciled?: boolean; pending?: boolean } {
  switch (filter) {
    case 'a_pointer': return { reconciled: false, pending: false };
    case 'a_venir': return { reconciled: false, pending: true };
    case 'pointee': return { reconciled: true };
    default: return {};
  }
}
