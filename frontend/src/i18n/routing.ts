import {defineRouting} from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { createElement, type ComponentProps } from 'react';

export type Locale = 'en' | 'fr';
 
export const routing = defineRouting({
  // A list of all locales that are supported
  locales : ['en', 'fr'] as Locale[],
 
  // Used when no locale matches
  defaultLocale: 'fr',

  // Disable locale prefix in URLs
  localePrefix: 'never'
});
 
// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
const navigation = createNavigation(routing);
export const {redirect, usePathname, useRouter, getPathname} = navigation;

/**
 * Link sans préchargement RSC par défaut : chaque lien visible déclenchait un `?_rsc=` côté
 * serveur (rafales de 8 requêtes simultanées, 256 Mo dépassés sur Cloud Run). La navigation au
 * clic reste côté client ; on peut réactiver au cas par cas avec `prefetch`.
 */
export function Link({ prefetch = false, ...props }: ComponentProps<typeof navigation.Link>) {
  return createElement(navigation.Link, { prefetch, ...props });
}
