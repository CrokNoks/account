import type { CSSProperties } from 'react';

/**
 * Style of a category/tag badge: the colour only tints the border and the
 * background (15 %); the text keeps the theme colour, so it stays readable in
 * both themes whatever the colour chosen (a dark #111 used as text colour
 * disappears on the dark theme).
 */
export function tintedBadgeStyle(color?: string | null): CSSProperties {
  if (!color) return {};
  return { borderColor: color, backgroundColor: `${color}26` };
}
