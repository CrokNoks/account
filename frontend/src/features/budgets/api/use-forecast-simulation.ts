import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ForecastSimulation } from '@/features/reporting/model/types';
import { SavedBudget } from '../model/budget-draft';

export const SIMULATION_DEBOUNCE_MS = 300;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Prévu simulé pour une liste complète de budgets (le calcul est fait par l'API, rien n'est écrit).
 * - requête envoyée après 300 ms sans frappe ; la `queryKey` contient la liste : une nouvelle valeur
 *   abandonne la requête précédente (signal) et seule la réponse de la dernière valeur est rendue ;
 * - `isStale` reste vrai tant que la réponse de la dernière valeur n'est pas arrivée : le chiffre
 *   précédent peut rester affiché, mais grisé.
 */
export function useForecastSimulation(params: {
  accountId: string | null;
  periodId: string | null;
  budgets: SavedBudget[];
  enabled: boolean;
}) {
  const { accountId, periodId, budgets, enabled } = params;
  const key = JSON.stringify(budgets);
  const debouncedKey = useDebounced(key, SIMULATION_DEBOUNCE_MS);

  const query = useQuery<ForecastSimulation>({
    queryKey: ['reporting', 'forecast-simulation', accountId, periodId, debouncedKey],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.post(
        `/${accountId}/periods/${periodId}/reporting/forecast-simulation`,
        { budgets: JSON.parse(debouncedKey) },
        { signal },
      );
      return data;
    },
    // Pas d'appel tant que la frappe n'est pas posée : seule la dernière valeur est envoyée.
    enabled: enabled && debouncedKey === key && !!accountId && !!periodId,
    placeholderData: keepPreviousData,
    // Le réel (dépenses) bouge : une réponse déjà vue pour la même liste n'est jamais réutilisée
    // telle quelle, elle est redemandée (et signalée périmée en attendant).
    staleTime: 0,
    retry: false,
  });

  return {
    data: enabled ? query.data : undefined,
    isError: enabled && query.isError,
    isStale: enabled && (debouncedKey !== key || query.isFetching || query.isPlaceholderData),
  };
}
