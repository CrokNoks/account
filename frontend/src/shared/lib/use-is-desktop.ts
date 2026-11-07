'use client';

import { useSyncExternalStore } from 'react';

/** Même seuil que le point de rupture `lg` de Tailwind (`--breakpoint-lg`, globals.css). */
const DESKTOP_QUERY = '(min-width: 60rem)';

// Sans matchMedia (tests jsdom, anciens navigateurs) : bureau.
const hasMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

function subscribe(onChange: () => void) {
  if (!hasMatchMedia()) return () => {};
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** `true` à partir de `lg` (bureau) ; `true` côté serveur. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (hasMatchMedia() ? window.matchMedia(DESKTOP_QUERY).matches : true),
    () => true,
  );
}
