'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export function ThemeToggle() {
  const t = useTranslations('Navigation');
  const { theme, setTheme } = useTheme();

  // false during server rendering and hydration, true on the client: the theme
  // is only known in the browser.
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return <div className="w-9 h-9" />; // Placeholder of the same size
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="w-9 h-9 border-none bg-transparent hover:bg-accent transition-colors"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">{t('toggle_theme')}</span>
    </Button>
  );
}

function noopSubscribe() {
  return () => {};
}
