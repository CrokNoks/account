import {
  AlertTriangle,
  Calendar,
  CreditCard,
  GitBranch,
  LayoutDashboard,
  PieChart,
  Receipt,
  Repeat,
  Settings,
  Sparkles,
  Tag,
  Tags,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

/** Les 5 entrées de la coque + Réglages (clés du namespace `Navigation`). */
export const NAV_ENTRIES = [
  { icon: LayoutDashboard, labelKey: 'today', href: '/', shortcut: 'F2' },
  { icon: Receipt, labelKey: 'operations', href: '/transactions', shortcut: 'F3' },
  { icon: TrendingUp, labelKey: 'analysis', href: '/evolution', shortcut: 'F4' },
  { icon: PieChart, labelKey: 'budgets', href: '/budgets', shortcut: 'F5' },
  { icon: Calendar, labelKey: 'due_dates', href: '/calendar', shortcut: 'F6' },
  { icon: Settings, labelKey: 'settings', href: '/settings' },
] as const satisfies readonly { icon: LucideIcon; labelKey: string; href: string; shortcut?: string }[];

type Route = {
  /** Route sans préfixe de langue. */
  path: string;
  /** Entrée du menu (son href) que la page rend active. */
  entry: string;
  /** Clé `Navigation` du titre du header. */
  titleKey: string;
};

/** Toutes les routes de `(dashboard)`. Une seule table : titre, entrée active, onglets. */
const ROUTES: readonly Route[] = [
  { path: '/', entry: '/', titleKey: 'today' },
  { path: '/transactions', entry: '/transactions', titleKey: 'operations' },
  { path: '/transactions/import', entry: '/transactions', titleKey: 'import' },
  { path: '/evolution', entry: '/evolution', titleKey: 'analysis' },
  { path: '/flux', entry: '/evolution', titleKey: 'flux' },
  { path: '/depassements', entry: '/evolution', titleKey: 'overruns' },
  { path: '/budgets', entry: '/budgets', titleKey: 'budgets' },
  { path: '/budgets/fixed', entry: '/budgets', titleKey: 'budgets' },
  { path: '/calendar', entry: '/calendar', titleKey: 'due_dates' },
  { path: '/cashflow', entry: '/calendar', titleKey: 'prevision' },
  { path: '/settings', entry: '/settings', titleKey: 'settings' },
  { path: '/accounts', entry: '/settings', titleKey: 'accounts' },
  { path: '/categories', entry: '/settings', titleKey: 'categories' },
  { path: '/tags', entry: '/settings', titleKey: 'tags' },
  { path: '/smart-rules', entry: '/settings', titleKey: 'smart_rules' },
  { path: '/recurring', entry: '/settings', titleKey: 'recurring' },
];

/** Onglets reliant les pages d'un même groupe (libellé = nom propre de la page). */
const TABS: Record<string, readonly { href: string; labelKey: string; icon: LucideIcon }[]> = {
  '/evolution': [
    { href: '/evolution', labelKey: 'evolution', icon: TrendingUp },
    { href: '/flux', labelKey: 'flux', icon: GitBranch },
    { href: '/depassements', labelKey: 'overruns', icon: AlertTriangle },
  ],
  '/calendar': [
    { href: '/calendar', labelKey: 'calendar', icon: Calendar },
    { href: '/cashflow', labelKey: 'prevision', icon: TrendingUp },
  ],
};

/** Pages listées sur la page Réglages, avec leur ligne d'explication (clé `Settings`). */
export const SETTINGS_PAGES = [
  { href: '/accounts', labelKey: 'accounts', descriptionKey: 'accounts_desc', icon: CreditCard },
  { href: '/categories', labelKey: 'categories', descriptionKey: 'categories_desc', icon: Tags },
  { href: '/tags', labelKey: 'tags', descriptionKey: 'tags_desc', icon: Tag },
  { href: '/smart-rules', labelKey: 'smart_rules', descriptionKey: 'smart_rules_desc', icon: Sparkles },
  { href: '/recurring', labelKey: 'recurring', descriptionKey: 'recurring_desc', icon: Repeat },
] as const;

export function tabsFor(entryHref: string) {
  return TABS[entryHref] ?? [];
}

/** Pages rattachées proposées par la palette Ctrl/Cmd + K en plus des entrées. */
export const ATTACHED_PAGES = [...TABS['/evolution'].slice(1), ...TABS['/calendar'].slice(1)];

function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(fr|en)(?=\/|$)/, '').replace(/\/+$/, '') || '/';
}

function matchRoute(pathname: string): Route | undefined {
  const path = stripLocale(pathname);
  return ROUTES.filter((r) => path === r.path || (r.path !== '/' && path.startsWith(`${r.path}/`))).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
}

/** Href de l'entrée du menu active pour un chemin (avec ou sans langue) ; `undefined` si route inconnue. */
export function activeEntryHref(pathname: string): string | undefined {
  return matchRoute(pathname)?.entry;
}


/** Clé `Navigation` du titre du header ; le tableau de bord pour une route inconnue. */
export function titleKeyFor(pathname: string): string {
  return matchRoute(pathname)?.titleKey ?? 'today';
}
