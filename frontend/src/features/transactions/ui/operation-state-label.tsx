import { cn } from '@/lib/utils';
import type { OperationState } from '../model/operation-state';

const styles: Record<OperationState, string> = {
  a_pointer: 'bg-primary/10 text-primary',
  a_venir: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  pointee: 'bg-green-500/10 text-green-700 dark:text-green-400',
};

/** État d'une opération écrit en toutes lettres (« À pointer », « Facture à venir », « Pointée »). */
export function OperationStateLabel({ state, t }: { state: OperationState; t: (key: string) => string }) {
  return (
    <span
      data-testid={`state-${state}`}
      className={cn('text-[10px] max-lg:text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap', styles[state])}
    >
      {t(`state.${state}`)}
    </span>
  );
}
