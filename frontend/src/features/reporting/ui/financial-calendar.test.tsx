import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { FinancialCalendar } from './financial-calendar';

const months = vi.hoisted(() => ({ byKey: {} as Record<string, { data?: unknown[]; isError?: boolean }>, asked: [] as string[] }));

vi.mock('@/features/accounts/model/use-account-store', () => ({
  useAccountStore: () => ({ activeAccountId: 'a1' }),
}));
vi.mock('@/features/categories/api/use-categories', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('../api/use-calendar-data', () => ({
  useCalendarData: (_a: string, year: number, month: number) => {
    const key = `${year}-${month}`;
    months.asked.push(key);
    const m = months.byKey[key] ?? {};
    return { isLoading: false, isError: !!m.isError, data: m.data };
  },
}));

const ev = (id: string, date: string, description: string, amount: string, type = 'actual') => ({
  id, date, description, amount, type, categoryId: null,
});

function Harness({ start }: { start: Date }) {
  const [d, setD] = useState(start);
  return <FinancialCalendar currentDate={d} onDateChange={setD} />;
}
const renderCalendar = (start: Date) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <Harness start={start} />
    </NextIntlClientProvider>,
  );

describe('Calendrier des échéances', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 29, 12));
    months.byKey = {};
    months.asked = [];
  });
  afterEach(() => vi.useRealTimers());

  it('une semaine à cheval sur deux mois montre les échéances des deux', () => {
    months.byKey['2026-10'] = { data: [ev('o1', '2026-10-30', 'Assurance auto', '-5800', 'recurring')] };
    months.byKey['2026-11'] = { data: [ev('n1', '2026-11-01', 'Loyer', '-85000', 'recurring')] };
    renderCalendar(new Date(2026, 9, 29));
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }));

    expect(screen.getByText('Assurance auto')).toBeTruthy();
    expect(screen.getByText('Loyer')).toBeTruthy();
    expect(months.asked).toContain('2026-10');
    expect(months.asked).toContain('2026-11');
  });

  it('navigue vers un mois passé et lit ce mois', () => {
    renderCalendar(new Date(2026, 9, 29));
    fireEvent.click(screen.getByRole('button', { name: 'Mois précédent' }));
    expect(months.asked).toContain('2026-9');
  });

  it('écrit le signe des montants et distingue réel et prévu par le trait', () => {
    months.byKey['2026-10'] = {
      data: [
        ev('r', '2026-10-30', 'Salaire', '320000', 'recurring'),
        ev('a', '2026-10-28', 'Courses', '-4500', 'actual'),
      ],
    };
    renderCalendar(new Date(2026, 9, 29));
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }));

    const text = document.body.textContent!.replace(/[  ]/g, ' ');
    expect(text).toContain('+3 200,00 €');
    expect(text).toContain('-45,00 €');
    expect(screen.getByText('Salaire').closest('[data-kind]')!.getAttribute('data-kind')).toBe('recurring');
    expect(screen.getByText('Salaire').closest('[data-kind]')!.className).toContain('border-dashed');
    expect(screen.getByText('Courses').closest('[data-kind]')!.className).not.toContain('border-dashed');
  });

  it('affiche une légende : réel, prévue, aujourd\'hui, point bas', () => {
    renderCalendar(new Date(2026, 9, 29));
    const legend = screen.getByRole('list', { name: 'Légende' });
    expect(legend.textContent).toContain('Réel');
    expect(legend.textContent).toContain('Prévue');
    expect(legend.textContent).toContain("Aujourd'hui");
    expect(legend.textContent).toContain('Point bas');
  });

  it('une erreur de chargement donne un message dans le bloc', () => {
    months.byKey['2026-10'] = { isError: true };
    renderCalendar(new Date(2026, 9, 29));
    expect(screen.getByRole('alert').textContent).toContain('calendrier');
  });

  it('le détail du jour dit « Réel » ou « Prévue »', () => {
    months.byKey['2026-10'] = { data: [ev('r', '2026-10-30', 'Salaire', '320000', 'recurring')] };
    renderCalendar(new Date(2026, 9, 29));
    fireEvent.click(screen.getByRole('button', { name: /30 octobre/ }));
    expect(screen.getAllByText('Prévue').length).toBeGreaterThan(0);
  });
});
