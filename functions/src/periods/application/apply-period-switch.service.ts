import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { PeriodRepository } from '../domain/period.repository.interface';
import { Period } from '../domain/period.entity';
import {
  ExistingRecurringTx,
  PeriodSwitchPlan,
  SWITCH_THRESHOLD_DAYS,
  planPeriodSwitches,
} from '../domain/period-switch';
import {
  startOfMonthDateOnly,
  todayDateOnly,
  toDateOnly,
} from '../../shared/domain/date-only';
import {
  dueDateMetadata,
  readDueDate,
  readRecurringId,
} from '../../shared/domain/recurring-due-date';

/** Période clôturée et période ouverte, telles que la personne les voit (CA6). */
export interface PeriodSwitchInfo {
  closed: { id: string; startDate: string; endDate: string };
  opened: { id: string; startDate: string; endDate: string };
  /** Nombre de bascules (plusieurs pour un import) ; `closed`/`opened` décrivent la dernière. */
  count: number;
  /** Vrai si la transaction a pris la date du jour en sortant du pending. */
  dateChanged: boolean;
  /** Import seulement : `pending` récurrentes supprimées (équivalent déjà importé). */
  removedPending?: number;
  /** Import seulement : récurrentes encore `pending` datées dans la période close. */
  remainingPending?: number;
}

export interface PeriodSwitchResult {
  /** Les transactions à enregistrer (dates réécrites, périodes posées si la bascule est écrite). */
  transactions: Transaction[];
  /** Vrai : les transactions sont déjà écrites (avec la bascule). Faux : l'appelant les enregistre comme avant. */
  written: boolean;
  periodSwitch: PeriodSwitchInfo | null;
}

export interface PeriodSwitchRequest {
  accountId: string;
  /** `create` : toute ligne est candidate ; `update` : seules les sorties du pending. */
  mode: 'create' | 'update';
  transactions: Transaction[];
  /** Ids sortis du pending par cette requête (mode `update`). */
  leavingPendingIds?: ReadonlySet<string>;
  /** Import : nettoie les `pending` récurrentes dont l'équivalent est importé (s'il y a bascule). */
  cleanup?: boolean;
}

/**
 * Service d'orchestration unique de la bascule de période, appelé par les quatre
 * chemins (création, import, modification, modification en lot) : la règle est
 * écrite une fois. Il lit l'état, appelle la fonction pure `planPeriodSwitches`,
 * puis écrit en une seule transaction base de données (`apply_period_switches`).
 * Sans catégorie déclencheuse (réglage vide par défaut) il ne fait rien.
 */
@Injectable()
export class ApplyPeriodSwitchService {
  private readonly logger = new Logger(ApplyPeriodSwitchService.name);

  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly periodRepository: PeriodRepository,
    private readonly recurringRepository: RecurringTransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async process(request: PeriodSwitchRequest): Promise<PeriodSwitchResult> {
    const { accountId, mode } = request;
    const leaving = request.leavingPendingIds ?? new Set<string>();

    const categories =
      await this.categoryRepository.findAllByAccount(accountId);
    const triggerCategory = categories.find((c) => c.isPeriodTrigger);
    const untouched: PeriodSwitchResult = {
      transactions: request.transactions,
      written: false,
      periodSwitch: null,
    };
    if (!triggerCategory) return untouched;

    const today = todayDateOnly();
    // Sortie du pending d'une paie : sa date devient celle du jour (la date reçue est ignorée).
    let dateChanged = false;
    const transactions = request.transactions.map((tx) => {
      if (
        mode === 'update' &&
        leaving.has(tx.id) &&
        tx.categoryId === triggerCategory.id
      ) {
        dateChanged = true;
        return tx.update({ date: today });
      }
      return tx;
    });

    const candidates = transactions.filter(
      (tx) =>
        tx.categoryId === triggerCategory.id &&
        (mode === 'create' || leaving.has(tx.id)),
    );
    if (candidates.length === 0) return { ...untouched, transactions };

    const periods = await this.periodRepository.findAllByAccount(accountId);
    const active = periods.find((p) => p.isActive) ?? null;
    const triggers = candidates.map((tx) => ({
      id: tx.id,
      date: tx.date,
      pending: tx.pending,
      categoryId: tx.categoryId,
      amount: tx.amount,
      recurringId: readRecurringId(tx.metadata),
    }));
    const base = {
      triggerCategoryId: triggerCategory.id,
      triggers,
      active: active
        ? { id: active.id, start: active.startDate, end: active.endDate }
        : null,
      today,
      newId: randomUUID,
    };

    // Lecture des récurrentes seulement si une bascule est possible.
    const mayDecide = triggers.some(
      (t) =>
        !t.pending &&
        t.date <= today &&
        active !== null &&
        t.date.getTime() - active.startDate.getTime() >=
          SWITCH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
    );
    let plan: PeriodSwitchPlan;
    let recurring: Awaited<
      ReturnType<RecurringTransactionRepository['findAllByAccount']>
    > = [];
    if (mayDecide) {
      recurring = await this.recurringRepository.findAllByAccount(accountId);
      const earliest = new Date(
        Math.min(...triggers.map((t) => t.date.getTime())),
      );
      const stored =
        await this.transactionRepository.findAllByAccountUnpaginated(
          accountId,
          {
            // Import : les `pending` à nettoyer remontent jusqu'au début de l'active.
            startDate:
              request.cleanup && active
                ? new Date(
                    Math.min(
                      startOfMonthDateOnly(earliest).getTime(),
                      active.startDate.getTime(),
                    ),
                  )
                : startOfMonthDateOnly(earliest),
          },
        );
      // État FINAL des lignes de la requête (date réécrite, plus pending) : une autre
      // paie du même lot ne doit pas être lue à son ancienne date ni encore pending.
      const finalById = new Map<string, Transaction>(
        transactions.map((tx) => [tx.id, tx]),
      );
      const known = [
        ...stored.filter((tx) => !finalById.has(tx.id)),
        ...transactions,
      ];
      plan = planPeriodSwitches({
        ...base,
        importLines: request.cleanup
          ? transactions.map((tx) => ({
              id: tx.id,
              date: tx.date,
              pending: tx.pending,
              categoryId: tx.categoryId,
              amount: tx.amount,
            }))
          : undefined,
        recurring: recurring.map((r) => ({
          id: r.id,
          categoryId: r.categoryId,
          description: r.description,
          amount: r.amount,
          dayOfMonth: r.dayOfMonth,
        })),
        existing: known.flatMap((tx): ExistingRecurringTx[] => {
          const recurringId = readRecurringId(tx.metadata);
          return recurringId
            ? [
                {
                  id: tx.id,
                  recurringId,
                  date: tx.date,
                  dueDate: readDueDate(tx.metadata),
                  pending: tx.pending,
                  categoryId: tx.categoryId,
                  amount: tx.amount,
                },
              ]
            : [];
        }),
      });
    } else {
      plan = planPeriodSwitches({ ...base, recurring: [], existing: [] });
    }

    for (const skip of plan.skipped) {
      this.logger.log({
        event: 'period_trigger_skipped',
        accountId,
        transactionId: skip.triggerId,
        reason: skip.reason,
        gapDays: skip.gapDays,
        leavingPending: leaving.has(skip.triggerId),
      });
    }
    if (plan.switches.length === 0 || !active) {
      return { ...untouched, transactions };
    }

    // Budgets de chaque nouvelle période : les montants par défaut du compte.
    const templates =
      await this.budgetRepository.findTemplatesByAccount(accountId);
    const writes = plan.switches.map((sw) => {
      const opened = Period.create({
        id: sw.opened.id,
        accountId,
        startDate: sw.opened.start,
        endDate: sw.opened.end,
        isActive: true,
      });
      return {
        closedId: sw.closed.id,
        closeEnd: sw.closed.end,
        closedPrevEnd: sw.closed.prevEnd,
        opened,
        budgets: templates
          .filter((t) => t.amount !== 0n)
          .map((t) =>
            BudgetInstance.create({
              periodId: opened.id,
              categoryId: t.categoryId,
              amountAllocated: t.amount,
            }),
          ),
      };
    });

    const asRecurring = (o: {
      recurringId: string;
      categoryId: string | null;
      description: string;
      amount: bigint;
      date: Date;
      dueDate: Date;
    }) =>
      Transaction.create({
        accountId,
        categoryId: o.categoryId,
        description: o.description,
        amount: o.amount,
        date: o.date,
        reconciled: false,
        pending: true,
        metadata: {
          source: 'recurring',
          recurringId: o.recurringId,
          ...dueDateMetadata(o.dueDate),
        },
      });
    const generated = plan.switches.flatMap((sw) => [
      ...sw.injected.map((o) => asRecurring(o)),
      ...(sw.nextPaie ? [asRecurring(sw.nextPaie)] : []),
    ]);
    // Le rattachement à une période se déduit des dates : les lignes sont écrites telles quelles.
    const lines = transactions;

    // Les lignes générées sont passées à part : si la bascule est perdue, seules celles
    // de la requête sont écrites (sinon double compte avec celles du gagnant).
    const result = await this.periodRepository.applyPeriodSwitches(
      accountId,
      active.id,
      writes,
      lines,
      generated,
      plan.removedPendingIds,
      mode === 'update',
    );

    // Lecture de ce qui est réellement en base (période posée par le trigger si pas de bascule).
    const stored = await this.transactionRepository.findAllByAccountUnpaginated(
      accountId,
      { ids: transactions.map((tx) => tx.id) },
    );
    const byId = new Map(stored.map((tx) => [tx.id, tx]));
    const readBack = transactions.map((tx) => byId.get(tx.id) ?? tx);

    if (!result.switched) {
      this.logger.log({
        event: 'period_trigger_skipped',
        accountId,
        reason: 'concurrent',
        gapDays: null,
      });
      return { transactions: readBack, written: true, periodSwitch: null };
    }

    for (const sw of plan.switches) {
      this.logger.log({
        event: 'period_opened',
        origin: 'trigger',
        accountId,
        periodId: sw.opened.id,
        start: toDateOnly(sw.opened.start),
        end: toDateOnly(sw.opened.end),
        injected: sw.injected.length,
        nextPaie: sw.nextPaie !== null,
        leavingPending: mode === 'update',
      });
    }
    if (result.removed > 0) {
      for (const id of plan.removedPendingIds) {
        this.logger.log({
          event: 'recurring_pending_removed',
          accountId,
          transactionId: id,
        });
      }
    }
    const last = plan.switches[plan.switches.length - 1];
    return {
      transactions: readBack,
      written: true,
      periodSwitch: {
        closed: {
          id: last.closed.id,
          startDate: toDateOnly(last.closed.start),
          endDate: toDateOnly(last.closed.end),
        },
        opened: {
          id: last.opened.id,
          startDate: toDateOnly(last.opened.start),
          endDate: toDateOnly(last.opened.end),
        },
        count: plan.switches.length,
        dateChanged,
        ...(request.cleanup
          ? {
              removedPending: result.removed,
              remainingPending: plan.remainingPending,
            }
          : {}),
      },
    };
  }
}
