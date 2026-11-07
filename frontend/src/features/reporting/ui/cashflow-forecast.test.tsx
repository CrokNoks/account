import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { CashflowForecast } from './cashflow-forecast';

const state = vi.hoisted(() => ({
  result: {} as { isLoading?: boolean; isError?: boolean; data?: unknown },
  asked: [] as number[],
}));

vi.mock('../api/use-cashflow-forecast', () => ({
  useCashflowForecast: (_a: string, days: number) => {
    state.asked.push(days);
    return state.result;
  },
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

const renderCurve = (props: { days?: 30 | 60 | 90; onDaysChange?: (d: 30 | 60 | 90) => void } = {}) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <CashflowForecast accountId="a1" {...props} />
    </NextIntlClientProvider>,
  );

const withEvents = {
  currentBalance: '105000',
  events: [{ date: '2026-07-15T00:00:00.000Z', description: 'Gros', amount: '-405000', projectedBalance: '-300000', type: 'recurring' }],
  lowPoint: { date: '2026-07-15T00:00:00.000Z', balance: '-300000' },
};

describe('Courbe de trésorerie', () => {
  beforeEach(() => {
    state.asked = [];
    state.result = { isLoading: false, data: withEvents };
  });

  it('écrit le point bas donné par le back, avec sa date, et les mentions', () => {
    renderCurve();
    const title = screen.getByRole('heading').textContent!;
    expect(title).toContain('Point bas');
    expect(title).toContain('15 juillet 2026');
    expect(title.replace(/\s/g, ' ')).toContain('3 000,00');
    expect(document.body.textContent).toContain('Solde du jour et récurrences uniquement, dépenses courantes non comprises.');
    expect(document.body.textContent).toContain("Ce n'est pas le prévu de fin de période");
    expect(document.body.textContent).toContain('sans récurrence correspondante');
  });

  it('propose 30, 60 et 90 jours, 30 par défaut, avec le choix indiqué sans la couleur seule', () => {
    const onDaysChange = vi.fn();
    renderCurve({ onDaysChange });
    expect(state.asked[0]).toBe(30);
    expect(screen.getByRole('button', { name: '30 jours' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '60 jours' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: '90 jours' }));
    expect(onDaysChange).toHaveBeenCalledWith(90);
  });

  it("demande au back l'horizon choisi", () => {
    renderCurve({ days: 60 });
    expect(state.asked).toContain(60);
  });

  it("sans récurrence, n'écrit pas de « 0 » parasite et renvoie vers les récurrences", () => {
    state.result = { isLoading: false, data: { currentBalance: '100000', events: [], lowPoint: { date: '2026-04-28T00:00:00.000Z', balance: '100000' } } };
    const { container } = renderCurve();
    const stray = Array.from(container.querySelectorAll('*')).filter(
      (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent === '0'),
    );
    expect(stray).toEqual([]);
    expect(container.textContent).toContain('Aucune récurrence');
    expect(screen.getByRole('link', { name: 'Gérer les récurrences' }).getAttribute('href')).toBe('/recurring');
  });

  it('affiche une erreur propre à la courbe', () => {
    state.result = { isLoading: false, isError: true };
    renderCurve();
    expect(screen.getByRole('alert').textContent).toContain('Impossible de charger la courbe');
  });
});
