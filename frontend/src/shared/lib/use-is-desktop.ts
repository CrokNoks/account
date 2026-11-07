'use client';

import { useSyncExternalStore } from 'react';

/** Même seuil que le point de rupture `lg` de Tailwind (`--breakpoint-lg`, globals.css). */
const DESKTOP_QUERY = '(min-width: 60rem)';

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** `true` à partir de `lg` (bureau) ; `true` côté serveur. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
