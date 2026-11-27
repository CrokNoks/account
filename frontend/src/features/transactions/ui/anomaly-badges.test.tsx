import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { describe, expect, it } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { AnomalyBadges } from './anomaly-badges';
import { TransactionTable } from './transaction-table';

const tx = (id: string) => ({
  id, accountId: 'a', categoryId: null, date: '2026-11-02', description: `ligne ${id}`,
  amount: '-1000', reconciled: false, pending: false, notes: null, metadata: null, tagIds: [],
  createdAt: '', updatedAt: '',
});

function Table() {
  const t = useTranslations('Transactions');
  return (
    <TransactionTable
      transactions={[tx('t1'), tx('t2')]}
      selectedIds={[]} onToggleSelect={() => {}} onEdit={() => {}}
      onDelete={() => {}} onTogglePointage={() => {}} onTagClick={() => {}}
      anomalyMarks={{ t1: ['duplicate'], t2: ['outlier', 'duplicate'] }}
      t={t}
    />
  );
}

function Badges({ marks }: { marks?: ('duplicate' | 'outlier')[] }) {
  const t = useTranslations('Transactions');
  return <AnomalyBadges marks={marks} t={t} />;
}

const wrap = (node: React.ReactNode, locale: 'fr' | 'en' = 'fr') =>
  render(<NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>{node}</NextIntlClientProvider>);

describe('Marques d\'anomalie des lignes', () => {
  it('écrit « Doublon possible » et « Dépense inhabituelle »', () => {
    wrap(<Badges marks={['duplicate', 'outlier']} />);
    expect(screen.getByText('Doublon possible')).toBeTruthy();
    expect(screen.getByText('Dépense inhabituelle')).toBeTruthy();
  });

  it('ne rend rien sans marque', () => {
    const { container } = wrap(<Badges />);
    expect(container.textContent).toBe('');
  });

  it('est traduit en anglais', () => {
    wrap(<Badges marks={['duplicate']} />, 'en');
    expect(screen.getByText('Possible duplicate')).toBeTruthy();
  });

  it('marque les seules lignes concernées dans le tableau', () => {
    wrap(<Table />);
    const rows = screen.getAllByRole('row');
    const row = (label: string) => rows.find((r) => r.textContent!.includes(label))!;
    expect(row('ligne t1').textContent).toContain('Doublon possible');
    expect(row('ligne t1').textContent).not.toContain('Dépense inhabituelle');
    expect(row('ligne t2').textContent).toContain('Dépense inhabituelle');
    expect(row('ligne t2').textContent).toContain('Doublon possible');
  });
});
