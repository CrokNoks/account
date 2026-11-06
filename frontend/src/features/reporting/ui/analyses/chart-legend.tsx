import { cn } from '@/lib/utils';

export interface LegendItem {
  label: string;
  /** Forme du repère : barre pleine, barre de budget ou courbe (la forme porte le sens, pas la couleur seule). */
  kind: 'bar' | 'bar-budget' | 'line';
}

/** Légende d'un graphique : repères et phrase qui dit ce que représentent barres, courbes et marques. */
export function ChartLegend({ items, note }: { items: LegendItem[]; note: string }) {
  return (
    <div data-testid="chart-legend" className="space-y-1 text-xs text-muted-foreground">
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <li key={item.label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                'inline-block',
                item.kind === 'line' ? 'h-0.5 w-4 bg-primary' : 'h-3 w-3 rounded-sm',
                item.kind === 'bar' && 'bg-primary',
                item.kind === 'bar-budget' && 'bg-muted-foreground',
              )}
            />
            {item.label}
          </li>
        ))}
      </ul>
      <p>{note}</p>
    </div>
  );
}
