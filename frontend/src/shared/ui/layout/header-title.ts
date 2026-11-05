/** Route (without locale prefix) -> key of the `Navigation` messages. */
const routeKeys: Record<string, string> = {
  '/': 'dashboard',
  '/calendar': 'calendar',
  '/evolution': 'evolution',
  '/depassements': 'overruns',
  '/flux': 'flux',
  '/cashflow': 'prevision',
  '/accounts': 'accounts',
  '/categories': 'categories',
  '/tags': 'tags',
  '/smart-rules': 'smart_rules',
  '/recurring': 'recurring',
  '/budgets': 'budgets',
  '/transactions': 'transactions',
  '/transactions/import': 'import',
};

/**
 * `Navigation` message key of the page title for a pathname: the most specific
 * known route (so `/transactions/import` is not `/transactions`), the
 * dashboard for an unknown route.
 */
export function headerTitleKey(pathname: string): string {
  const path = pathname.replace(/^\/(fr|en)(?=\/|$)/, '').replace(/\/+$/, '') || '/';
  const route = Object.keys(routeKeys)
    .filter((r) => path === r || (r !== '/' && path.startsWith(`${r}/`)))
    .sort((a, b) => b.length - a.length)[0];
  return routeKeys[route ?? '/'];
}
