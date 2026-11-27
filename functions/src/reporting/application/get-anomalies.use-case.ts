import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';
import {
  addMonthsDateOnly,
  formatDateOnlyFr,
  startOfMonthDateOnly,
  toDateOnly,
  todayDateOnly,
} from '../../shared/domain/date-only';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import {
  isInPeriodWindow,
  periodLoadEndDate,
  toWindowPeriod,
  WindowPeriod,
} from '../domain/period-window';

export interface Anomaly {
  id: string;
  type: 'duplicate' | 'outlier';
  title: string;
  description: string;
  severity: 'medium' | 'high';
  transactionIds: string[];
}

@Injectable()
export class GetAnomaliesUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly periodRepository: PeriodRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(accountId: string, periodId?: string): Promise<Anomaly[]> {
    let targetStartDate: Date;
    // Fenêtre d'analyse : celle du prévu (domain/period-window). Sans période,
    // le mois en cours jusqu'à aujourd'hui.
    let window: WindowPeriod;

    if (periodId) {
      const period = ensureBelongsToAccount(
        await this.periodRepository.findById(periodId),
        accountId,
        'Period',
      );
      targetStartDate = period.startDate;
      window = toWindowPeriod(
        period,
        await this.categoryRepository.findAllByAccount(accountId),
      );
    } else {
      const today = todayDateOnly();
      targetStartDate = startOfMonthDateOnly(today);
      window = {
        startDate: targetStartDate,
        endDate: today,
        isActive: false,
        triggerCategoryId: null,
      };
    }

    const historyStartDate = addMonthsDateOnly(targetStartDate, -6);

    const allTransactions =
      await this.transactionRepository.findAllByAccountUnpaginated(accountId, {
        startDate: historyStartDate,
        endDate: periodLoadEndDate(window),
      });

    console.log(
      `[GetAnomalies] Analyzing ${allTransactions.length} transactions for account ${accountId}`,
    );

    const targetTransactions = allTransactions.filter((t) =>
      isInPeriodWindow(t, window),
    );
    // Historique de comparaison : avant la période seulement (jamais une
    // opération future).
    const history = allTransactions.filter((t) => t.date < targetStartDate);

    console.log(
      `[GetAnomalies] Target transactions count: ${targetTransactions.length}`,
    );

    const anomalies: Anomaly[] = [];

    const duplicateGroups = this.findDuplicates(targetTransactions);
    for (const group of duplicateGroups) {
      anomalies.push({
        id: `dup-${group[0].id}`,
        type: 'duplicate',
        title: 'Doublon potentiel détecté',
        description: `Ces transactions du ${formatDateOnlyFr(group[0].date)} pour ${this.formatAmount(group[0].amount)} semblent identiques.`,
        severity: 'high',
        transactionIds: group.map((t) => t.id),
      });
    }

    const outliers = this.findOutliers(targetTransactions, history);
    for (const outlier of outliers) {
      anomalies.push({
        id: `out-${outlier.transaction.id}`,
        type: 'outlier',
        title: 'Dépense inhabituellement élevée',
        description: `Cette transaction de ${this.formatAmount(outlier.transaction.amount)} est très supérieure à votre moyenne historique pour cette catégorie (${this.formatAmount(outlier.average)}).`,
        severity: 'medium',
        transactionIds: [outlier.transaction.id],
      });
    }

    return anomalies;
  }

  private findDuplicates(transactions: Transaction[]): Transaction[][] {
    const groups = new Map<string, Transaction[]>();

    for (const t of transactions) {
      if (t.amount >= BigInt(0) || t.amount > BigInt(-500)) continue;

      const metadata = t.metadata;
      const ignoredAnomalies = (metadata?.ignoredAnomalies as string[]) || [];
      if (ignoredAnomalies.includes('duplicate')) continue;

      // Même jour, même montant, même catégorie (« sans catégorie » = une catégorie à part)
      const key = `${toDateOnly(t.date)}_${t.amount.toString()}_${t.categoryId ?? ''}`;

      const existing = groups.get(key) || [];
      existing.push(t);
      groups.set(key, existing);
    }

    return Array.from(groups.values()).filter((group) => group.length > 1);
  }

  private findOutliers(
    targetTransactions: Transaction[],
    allTransactions: Transaction[],
  ): { transaction: Transaction; average: bigint }[] {
    const outliers: { transaction: Transaction; average: bigint }[] = [];
    const targetIds = new Set(targetTransactions.map((t) => t.id));
    const categoryAverages = new Map<string, { sum: bigint; count: number }>();

    for (const t of allTransactions) {
      if (!t.categoryId || t.amount >= BigInt(0) || targetIds.has(t.id))
        continue;

      const current = categoryAverages.get(t.categoryId) || {
        sum: BigInt(0),
        count: 0,
      };
      current.sum += t.amount;
      current.count += 1;
      categoryAverages.set(t.categoryId, current);
    }

    for (const t of targetTransactions) {
      if (!t.categoryId || t.amount >= BigInt(0)) continue;

      const metadata = t.metadata;
      const ignoredAnomalies = (metadata?.ignoredAnomalies as string[]) || [];
      if (ignoredAnomalies.includes('outlier')) continue;

      const stats = categoryAverages.get(t.categoryId);
      if (!stats || stats.count < 3) continue;

      const average = stats.sum / BigInt(stats.count);
      if (average < BigInt(0) && t.amount < average * BigInt(3)) {
        outliers.push({ transaction: t, average });
      }
    }

    return outliers;
  }

  private formatAmount(cents: bigint): string {
    const euros = Number(cents) / 100;
    return euros.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    });
  }
}
