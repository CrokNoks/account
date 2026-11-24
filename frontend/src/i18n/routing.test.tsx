import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Le Link de next-intl est remplacé par un témoin qui expose la prop `prefetch` reçue.
vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: ({ prefetch, children, ...p }: { prefetch?: boolean | null; children: React.ReactNode; href: string }) => (
      <a data-prefetch={String(prefetch)} {...p}>{children}</a>
    ),
    redirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
    getPathname: vi.fn(),
  }),
}));

import { Link } from './routing';

describe('Link : pas de préchargement RSC (instance SSR de 256 Mo)', () => {
  it('désactive le préchargement par défaut', () => {
    render(<Link href="/transactions">Opérations</Link>);
    expect(screen.getByRole('link').getAttribute('data-prefetch')).toBe('false');
  });

  it('laisse une page le réactiver explicitement', () => {
    render(<Link href="/transactions" prefetch>Opérations</Link>);
    expect(screen.getByRole('link').getAttribute('data-prefetch')).toBe('true');
  });
});
