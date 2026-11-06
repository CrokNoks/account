/** Jetons de `globals.css` pour les graphiques (clair et sombre) : aucune couleur en dur. */
export const CHART = {
  strong: 'var(--chart-1)',
  /** Budget : le gris de texte secondaire (≥ 3:1 sur la surface en clair et en sombre), distinct du bleu du réel. */
  budget: 'var(--muted-foreground)',
  grid: 'var(--border)',
  text: 'var(--muted-foreground)',
  alert: 'var(--destructive)',
} as const;

export const AXIS_TICK = { fill: CHART.text, fontSize: 12 } as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'var(--popover-foreground)' },
} as const;

/** Largeur minimale par période : le graphique défile horizontalement au lieu de s'écraser sur mobile. */
export const PX_PER_PERIOD = 72;
