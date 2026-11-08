'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods } from '../api/use-periods';
import { PeriodSelect } from '@/features/periods/ui/period-select';
import { usePeriodBudgets } from '@/features/periods/api/use-period-budgets';
import { useUpdatePeriodBudgets } from '@/features/periods/api/use-update-period-budgets';
import { useBudgetBreakdown } from '@/features/reporting/api/use-budget-breakdown';
import { useReportingStats } from '@/features/reporting/api/use-reporting-stats';
import { overrunAmount } from '@/features/reporting/model/current-overruns';
import { Button } from '@/components/ui/button';
import { AmountInput } from '@/components/ui/amount-input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { confirmLeave, registerLeaveGuard } from '@/shared/model/leave-guard';
import { useForecastSimulation } from '../api/use-forecast-simulation';
import {
  Drafts,
  SavedBudget,
  buildBudgets,
  changedDrafts,
  displayValue,
  draftErrors,
} from '../model/budget-draft';
import { sortBudgetRows, type BudgetRow } from '../model/sort-budget-lines';
import { ClosedPeriodWarning } from './closed-period-warning';

const NO_BUDGETS: SavedBudget[] = [];

/**
 * Budgets de la période choisie : saisie des montants avec simulation immédiate du prévu.
 * Rien n'est écrit avant « Enregistrer ». Le calcul du prévu est fait par l'API (pas de formule ici).
 */
export function BudgetsScreen() {
  const formatCurrency = useFormatCurrency();
  const signed = (cents: string) => (BigInt(cents) > BigInt(0) ? `+${formatCurrency(cents)}` : formatCurrency(cents));
  const t = useTranslations('BudgetsScreen');
  const tc = useTranslations('Common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { activeAccountId, activePeriodId, setActivePeriodId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  const { data: stats } = useReportingStats(activeAccountId, activePeriodId);
  const { data: breakdown, isLoading } = useBudgetBreakdown(activeAccountId, activePeriodId);
  const { data: savedBudgets } = usePeriodBudgets(activeAccountId, activePeriodId);
  const { mutateAsync: saveBudgets, isPending } = useUpdatePeriodBudgets();

  const [drafts, setDrafts] = useState<Drafts>({});
  // Budgets tels que lus à la première saisie : figés tant qu'il y a des saisies (un rechargement en
  // arrière-plan ne doit pas masquer le changement d'une autre personne). Envoyés comme `expectedBudgets`.
  const [frozen, setFrozen] = useState<SavedBudget[] | null>(null);
  const [rejected, setRejected] = useState<Drafts>({});
  const [banner, setBanner] = useState<string | null>(null);
  const submitting = useRef(false);

  // Changement de période ou de compte : l'abandon a déjà été confirmé, on repart de l'enregistré.
  const scope = `${activeAccountId}:${activePeriodId}`;
  const [lastScope, setLastScope] = useState(scope);
  if (scope !== lastScope) {
    setLastScope(scope);
    setDrafts({});
    setFrozen(null);
    setRejected({});
    setBanner(null);
  }

  useEffect(() => {
    if (periods && periods.length > 0 && !activePeriodId) {
      setActivePeriodId((periods.find((p) => p.isActive) ?? periods[0]).id);
    }
  }, [periods, activePeriodId, setActivePeriodId]);

  const reference: SavedBudget[] = useMemo(
    () => frozen ?? (savedBudgets ?? NO_BUDGETS).map((b) => ({ categoryId: b.categoryId, amountAllocated: b.amountAllocated })),
    [frozen, savedBudgets],
  );
  const changed = useMemo(() => changedDrafts(reference, drafts), [reference, drafts]);
  const errors = useMemo(() => draftErrors(reference, drafts), [reference, drafts]);
  const dirty = Object.keys(changed).length > 0;
  const hasErrors = Object.keys(errors).length > 0;
  const full = useMemo(() => buildBudgets(reference, drafts), [reference, drafts]);

  const simulation = useForecastSimulation({
    accountId: activeAccountId,
    periodId: activePeriodId,
    budgets: full,
    enabled: dirty && !hasErrors,
  });
  const sim = simulation.data;

  // Garde de sortie : changement de compte (sélecteur), navigation interne, fermeture de l'onglet.
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const discardMessage = t('discard_confirm');
  useEffect(() => {
    const off = registerLeaveGuard(() => dirtyRef.current, discardMessage);
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      if (link.pathname === window.location.pathname) return;
      if (!confirmLeave()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      off();
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [discardMessage]);

  const lines = breakdown ? sortBudgetRows(breakdown) : [];
  const period = periods?.find((p) => p.id === activePeriodId);
  const ready = savedBudgets !== undefined;

  const reset = () => {
    setDrafts({});
    setFrozen(null);
    setRejected({});
  };

  const onEdit = (categoryId: string, text: string) => {
    setBanner(null);
    setRejected((r) => {
      if (!(categoryId in r)) return r;
      return Object.fromEntries(Object.entries(r).filter(([id]) => id !== categoryId));
    });
    const base = frozen ?? reference;
    const next = { ...drafts, [categoryId]: text };
    if (!frozen) setFrozen(base);
    if (!dirtyAfter(base, next)) {
      // tout est revenu à l'enregistré : on reprend l'enregistré courant
      setDrafts({});
      setFrozen(null);
      return;
    }
    setDrafts(next);
  };

  const onPeriodChange = (id: string) => {
    if (id === activePeriodId) return;
    if (!confirmLeave()) return;
    setActivePeriodId(id);
  };

  const onCancel = () => {
    reset();
    setBanner(null);
  };

  const onSave = async () => {
    if (submitting.current || !dirty || !activeAccountId || !activePeriodId) return;
    if (hasErrors) {
      setBanner(t('fix_amounts'));
      return;
    }
    submitting.current = true;
    setBanner(null);
    try {
      await saveBudgets({
        accountId: activeAccountId,
        periodId: activePeriodId,
        data: { budgets: full, expectedBudgets: reference },
      });
      reset();
      toast.success(t('saved'));
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409 && error.response.data?.code === 'BUDGETS_CHANGED') {
        const mine = changed;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['periods', activePeriodId, 'budgets'] }),
          queryClient.invalidateQueries({ queryKey: ['reporting'] }),
        ]);
        setDrafts({});
        setFrozen(null);
        setRejected(mine);
        setBanner(t('changed_elsewhere'));
      } else {
        setBanner(t('save_error'));
      }
    } finally {
      submitting.current = false;
    }
  };

  // « Sans effet » : le total prévu du côté change mais le prévu ne bouge pas (le réel est plus haut).
  const touches = (income: boolean) => lines.some((l) => l.isIncome === income && l.line.categoryId in changed);
  const noEffect =
    !!sim &&
    !simulation.isStale &&
    stats !== undefined &&
    ((touches(false) && sim.plannedExpenses !== stats.plannedExpenses && BigInt(sim.expensesEffect) === BigInt(0)) ||
      (touches(true) && sim.plannedIncome !== stats.plannedIncome && BigInt(sim.incomeEffect) === BigInt(0)));

  const forecast = sim?.forecastBalance ?? stats?.forecastBalance;
  const plannedIncome = sim?.plannedIncome ?? stats?.plannedIncome;
  const plannedExpenses = sim?.plannedExpenses ?? stats?.plannedExpenses;
  const grey = dirty && !hasErrors && (simulation.isStale || !sim);

  const spendingRows = lines.filter((row) => !row.isRevenue);
  const revenueRows = lines.filter((row) => row.isRevenue);

  // Une ligne de budget : la colonne « Reste » n'existe que pour les dépenses, épargne et virements (pas pour les revenus).
  const renderRow = ({ line, isIncome }: BudgetRow, withRemaining: boolean) => {
    const over = isIncome ? BigInt(0) : overrunAmount(line);
    const id = line.categoryId;
    const error = errors[id];
    return (
      <TableRow key={id}>
        <TableCell className="font-medium">{line.name}</TableCell>
        <TableCell className="text-right tabular-nums">{formatCurrency(line.real)}</TableCell>
        {withRemaining && (
          <TableCell className="text-right tabular-nums">
            {over > BigInt(0) ? (
              <span data-testid="over-budget" className="font-semibold text-warn">
                {t('over', { amount: formatCurrency(over) })}
              </span>
            ) : (
              t('left', { amount: formatCurrency(BigInt(line.remaining) > BigInt(0) ? BigInt(line.remaining) : BigInt(0)) })
            )}
          </TableCell>
        )}
        <TableCell className="min-w-40 text-right">
          <AmountInput
            aria-label={t('budget_of', { name: line.name })}
            aria-invalid={!!error}
            placeholder={tc('amount_placeholder')}
            disabled={!ready || isPending}
            value={displayValue(reference, drafts, id, locale)}
            onChange={(e) => onEdit(id, e.target.value)}
            className="h-11 text-right tabular-nums"
          />
          {error && (
            <p role="alert" data-testid="row-error" className="mt-1 text-xs text-destructive">
              {error === 'negative' ? t('negative_amount') : t('unreadable_amount')}
            </p>
          )}
          {id in rejected && (
            <p data-testid="rejected-input" className="mt-1 text-xs text-muted-foreground">
              {t('your_input', { value: rejected[id] === '' ? '0' : rejected[id] })}
            </p>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodSelect periods={periods} value={activePeriodId} onChange={onPeriodChange} />
      </div>

      <ClosedPeriodWarning period={period} />

      {stats && forecast !== undefined && plannedIncome !== undefined && plannedExpenses !== undefined && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure
            label={t('forecast')}
            value={formatCurrency(forecast)}
            grey={grey}
            testId="forecast-figure"
            note={
              dirty && !hasErrors ? (
                <>
                  {grey && <span data-testid="calculating">{t('calculating')}</span>}
                  {sim && (
                    <span data-testid="forecast-delta">
                      {BigInt(sim.delta) === BigInt(0)
                        ? t('same_as_saved')
                        : t('vs_saved', { amount: signed(sim.delta) })}
                    </span>
                  )}
                  {noEffect && (
                    <span data-testid="no-effect" className="font-semibold">
                      {t('no_effect')}
                    </span>
                  )}
                  {simulation.isError && <span role="alert">{t('simulation_error')}</span>}
                </>
              ) : null
            }
          />
          <Figure label={t('planned_income')} value={formatCurrency(plannedIncome)} grey={grey} />
          <Figure label={t('total_budgeted')} value={formatCurrency(plannedExpenses)} grey={grey} />
        </div>
      )}

      {banner && (
        <div role="alert" data-testid="budgets-banner" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {banner}
        </div>
      )}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : lines.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          {spendingRows.length > 0 && (
            <Card className="border-2 shadow-sm">
              <CardContent className="overflow-x-auto p-0">
                <Table aria-label={t('expenses_section')}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('category')}</TableHead>
                      <TableHead className="text-right">{t('real')}</TableHead>
                      <TableHead className="text-right">{t('remaining')}</TableHead>
                      <TableHead className="text-right">{t('budget')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{spendingRows.map((row) => renderRow(row, true))}</TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {revenueRows.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t('income_section')}</h3>
              <Card className="border-2 shadow-sm">
                <CardContent className="overflow-x-auto p-0">
                  <Table aria-label={t('income_section')}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('category')}</TableHead>
                        <TableHead className="text-right">{t('real')}</TableHead>
                        <TableHead className="text-right">{t('budget')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>{revenueRows.map((row) => renderRow(row, false))}</TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}

      {dirty && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-sm text-muted-foreground">{t('unsaved')}</span>
          <Button variant="outline" className="min-h-11" onClick={onCancel} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button className="min-h-11" onClick={onSave} disabled={isPending || hasErrors}>
            {isPending ? t('saving') : t('save')}
          </Button>
        </div>
      )}
    </div>
  );
}

const dirtyAfter = (reference: SavedBudget[], drafts: Drafts) => Object.keys(changedDrafts(reference, drafts)).length > 0;

function Figure({
  label,
  value,
  grey = false,
  note,
  testId,
}: {
  label: string;
  value: string;
  grey?: boolean;
  note?: React.ReactNode;
  testId?: string;
}) {
  return (
    <Card className="border-2 shadow-sm">
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span data-testid={testId} data-stale={grey} className={`text-2xl font-bold tabular-nums ${grey ? 'opacity-50' : ''}`}>
          {value}
        </span>
        {note && <span className="flex flex-col text-xs text-muted-foreground">{note}</span>}
      </CardContent>
    </Card>
  );
}
