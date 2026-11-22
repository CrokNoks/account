import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { TransactionFilters } from './transaction-filters';

// Like the real ones: a button that receives the id.
vi.mock('@/features/tags/ui/tag-selector', () => ({
  TagSelector: ({ id }: { id?: string }) => <button type="button" id={id} data-testid="tags" />,
}));
vi.mock('@/features/categories/ui/category-selector', () => ({
  CategorySelector: ({ id }: { id?: string }) => <button type="button" id={id} data-testid="category" />,
}));

const t = (key: string) => key;

function renderFilters(props: { periodControlled?: boolean } = {}) {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <TransactionFilters
        search=""
        setSearch={vi.fn()}
        isFilterOpen
        setIsFilterOpen={vi.fn()}
        activeFiltersCount={0}
        activeAccountId="acc-1"
        selectedCategoryId="all"
        setSelectedCategoryId={vi.fn()}
        selectedTagIds={[]}
        setSelectedTagIds={vi.fn()}
        stateFilter="all"
        onStateChange={vi.fn()}
        minAmount=""
        setMinAmount={vi.fn()}
        maxAmount=""
        setMaxAmount={vi.fn()}
        startDate=""
        setStartDate={vi.fn()}
        endDate=""
        setEndDate={vi.fn()}
        effectivePeriodId="all"
        setSelectedPeriodId={vi.fn()}
        periods={[]}
        onApply={vi.fn()}
        onReset={vi.fn()}
        t={t as never}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('TransactionFilters labels', () => {
  it('links the visible labels to their first field', () => {
    renderFilters();

    expect(screen.getByLabelText('fields.category')).toBe(screen.getByTestId('category'));
    expect(screen.getByLabelText('filters.tags')).toBe(screen.getByTestId('tags'));
    expect(screen.getByLabelText('amount_range')).toHaveAttribute('placeholder', 'filters.min');
    expect(screen.getByLabelText('date_range')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('budget_period')).toHaveTextContent('all_periods');
  });

  it('has no period field when the period is chosen elsewhere', () => {
    renderFilters({ periodControlled: true });

    expect(screen.queryByLabelText('budget_period')).toBeNull();
  });
});
