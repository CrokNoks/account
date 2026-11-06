import { describe, expect, it } from 'vitest';
import { operationState, stateFilterToQuery, type OperationState, type StateFilter } from './operation-state';

// Table des 4 combinaisons : la même est écrite côté back (supabase-transaction.repository.spec.ts).
const table: Array<{ name: string; reconciled: boolean; pending: boolean; state: OperationState }> = [
  { name: 'CB à pointer', reconciled: false, pending: false, state: 'a_pointer' },
  { name: 'facture à venir', reconciled: false, pending: true, state: 'a_venir' },
  { name: 'pointée', reconciled: true, pending: false, state: 'pointee' },
  { name: 'pending rapprochée', reconciled: true, pending: true, state: 'pointee' },
];

// Filtre en mémoire qui applique la requête envoyée au back (deux égalités indépendantes).
const matches = (row: { reconciled: boolean; pending: boolean }, filter: StateFilter) => {
  const q = stateFilterToQuery(filter);
  return (q.reconciled === undefined || q.reconciled === row.reconciled)
    && (q.pending === undefined || q.pending === row.pending);
};

describe('état d\'une opération', () => {
  it.each(table)('$name : état $state', ({ reconciled, pending, state }) => {
    expect(operationState({ reconciled, pending })).toBe(state);
  });

  it('traite un champ absent ou non booléen comme faux (donnée ancienne)', () => {
    expect(operationState({} as never)).toBe('a_pointer');
    expect(operationState({ reconciled: 'oui', pending: 1 } as never)).toBe('a_pointer');
    expect(operationState({ reconciled: undefined, pending: true } as never)).toBe('a_venir');
  });

  it.each(['a_pointer', 'a_venir', 'pointee'] as const)('le filtre %s garde exactement les lignes de cet état', (filter) => {
    const kept = table.filter((row) => matches(row, filter)).map((row) => row.name);
    expect(kept).toEqual(table.filter((row) => row.state === filter).map((row) => row.name));
  });

  it('le filtre « Pointées » garde la pending rapprochée', () => {
    expect(table.filter((row) => matches(row, 'pointee')).map((row) => row.name)).toEqual(['pointée', 'pending rapprochée']);
  });

  it('le filtre « toutes » n\'envoie aucun paramètre et garde les 4 lignes', () => {
    expect(stateFilterToQuery('all')).toEqual({});
    expect(table.filter((row) => matches(row, 'all'))).toHaveLength(4);
  });

  it('« Pointées » n\'envoie pas pending (sinon la pending rapprochée serait exclue)', () => {
    expect('pending' in stateFilterToQuery('pointee')).toBe(false);
  });

  it('« Facture à venir » envoie reconciled faux (sinon la pending rapprochée y serait)', () => {
    expect(stateFilterToQuery('a_venir')).toEqual({ reconciled: false, pending: true });
  });
});
