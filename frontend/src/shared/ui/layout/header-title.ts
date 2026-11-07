import { titleKeyFor } from './nav-config';

/**
 * `Navigation` message key of the page title for a pathname: the entry name for the
 * 5 entries and Réglages, the page's own name for an attached page (Comptes…),
 * the most specific known route, the first entry for an unknown route.
 */
export function headerTitleKey(pathname: string): string {
  return titleKeyFor(pathname);
}
