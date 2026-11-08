'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { operationsHref } from '@/features/transactions/model/operations-link';
import { useOverrunsByPeriod } from '../../api/use-overruns';
import { buildOverrunsGrid } from '../../model/overruns-grid';
import { shortPeriodLabel } from './period-label';

export function OverrunsTab() {
  const formatCurrency = useFormatCurrency();
  const t = useTranslations('Reporting.analyses');
  const to = useTranslations('Reporting.analyses.overruns');
  const locale = useLocale();
  const { activeAccountId } = useAccountStore();
  const { data, isLoading, isError } = useOverrunsByPeriod(activeAccountId);
  const grid = useMemo(() => buildOverrunsGrid(data?.periods ?? []), [data]);

  if (isLoading) return <div className="h-48 bg-muted animate-pulse rounded-xl" />;
  if (isError) return <p role="alert" className="text-sm text-destructive">{to('error')}</p>;
  if (grid.columns.length === 0) {
    return <p data-testid="overruns-no-period" className="text-muted-foreground">{t('no_closed_period')}</p>;
  }

  return (
    <div className="space-y-4">
      {grid.rows.length === 0 && (
        <p data-testid="overruns-none" className="text-muted-foreground">{to('none')}</p>
      )}
      <Table data-testid="overruns-grid">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs">{to('category')}</TableHead>
            {grid.columns.map((c) => (
              <TableHead key={c.periodId} className="text-right text-xs whitespace-nowrap">
                {shortPeriodLabel(c.startDate, locale)}
              </TableHead>
            ))}
            <TableHead className="text-right text-xs">{to('total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grid.rows.map((row) => (
            <TableRow key={row.categoryId} data-testid="overruns-row">
              <TableCell className="p-0 text-sm font-medium">
                <Link
                  href={operationsHref({ categoryId: row.categoryId, allPeriods: true })}
                  aria-label={to('open_operations', { name: row.name })}
                  className="flex min-h-11 items-center px-2 underline-offset-4 hover:underline"
                >
                  {row.name}
                </Link>
              </TableCell>
              {row.cells.map((cell, i) => (
                <TableCell key={grid.columns[i].periodId} className="py-2 text-right text-sm tabular-nums whitespace-nowrap" data-testid="overruns-cell">
                  {cell === null ? (
                    <>
                      <span aria-hidden>—</span>
                      <span className="sr-only">{to('no_excess')}</span>
                    </>
                  ) : (
                    <span className="font-semibold text-warn">{formatCurrency(cell)}</span>
                  )}
                </TableCell>
              ))}
              <TableCell className="py-2 text-right text-sm font-bold tabular-nums whitespace-nowrap" data-testid="overruns-total">
                {formatCurrency(row.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="space-y-1 text-xs text-muted-foreground" data-testid="overruns-legend">
        <p>{to('legend')}</p>
        <p>{to('link_hint')}</p>
      </div>
    </div>
  );
}
