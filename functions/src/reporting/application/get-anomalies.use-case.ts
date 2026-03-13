import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { startOfMonth, subMonths, isSameDay } from 'date-fns';

export interface Anomaly {
  id: string;
  type: 'duplicate' | 'spike' | 'outlier';
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
  ) {}

  async execute(accountId: string, periodId?: string): Promise<Anomaly[]> {
    let targetStartDate: Date;
    let targetEndDate: Date;

    if (periodId) {
      const period = await this.periodRepository.findById(periodId);
      if (!period) throw new Error('Period not found');
      targetStartDate = period.startDate;
      targetEndDate = period.endDate;
    } else {
      // Default to current month if no period specified
      const now = new Date();
      targetStartDate = startOfMonth(now);
      targetEndDate = now; 
    }

    // We need historical data for spikes and outliers (e.g., 6 months back)
    const historyStartDate = subMonths(targetStartDate, 6);

    const allTransactions = await this.transactionRepository.findAllByAccount(
      accountId,
      { startDate: historyStartDate, endDate: targetEndDate },
    );

    // Filter transactions that fall within the target period for the primary anomaly checks
    const targetTransactions = allTransactions.filter(
      (t) => t.date >= targetStartDate && t.date <= targetEndDate
    );

    const anomalies: Anomaly[] = [];

    // 1. Detect Duplicates (Strict: Same day, exact same amount, same sign)
    const duplicateGroups = this.findDuplicates(targetTransactions);
    for (const group of duplicateGroups) {
      anomalies.push({
        id: `dup-${group[0].id}`,
        type: 'duplicate',
        title: 'Doublon potentiel détecté',
        description: `Ces transactions du ${group[0].date.toLocaleDateString('fr-FR')} pour ${this.formatAmount(group[0].amount)} semblent identiques.`,
        severity: 'high',
        transactionIds: group.map(t => t.id),
      });
    }

    // 2. Detect Outliers (Amount > 3x the average of the same category over the last 6 months)
    const outliers = this.findOutliers(targetTransactions, allTransactions);
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
      // Ignore positive amounts (incomes) and small amounts (< 5€) for strict duplicate check to reduce noise
      if (t.amount >= BigInt(0) || t.amount > BigInt(-500)) continue;

      // Key: Date + Amount
      const key = `${t.date.toISOString().split('T')[0]}_${t.amount.toString()}`;
      
      const existing = groups.get(key) || [];
      existing.push(t);
      groups.set(key, existing);
    }

    return Array.from(groups.values()).filter(group => group.length > 1);
  }

  private findOutliers(targetTransactions: Transaction[], allTransactions: Transaction[]): { transaction: Transaction, average: bigint }[] {
    const outliers: { transaction: Transaction, average: bigint }[] = [];

    // Group historical transactions by category to calculate averages
    // Exclude target transactions from the historical baseline to avoid skewing the average
    const targetIds = new Set(targetTransactions.map(t => t.id));
    const categoryAverages = new Map<string, { sum: bigint, count: number }>();
    
    for (const t of allTransactions) {
      if (!t.categoryId || t.amount >= BigInt(0) || targetIds.has(t.id)) continue; 
      
      const current = categoryAverages.get(t.categoryId) || { sum: BigInt(0), count: 0 };
      current.sum += t.amount;
      current.count += 1;
      categoryAverages.set(t.categoryId, current);
    }

    for (const t of targetTransactions) {
        if (!t.categoryId || t.amount >= BigInt(0)) continue;

        const stats = categoryAverages.get(t.categoryId);
        if (!stats || stats.count < 3) continue; // Need at least 3 historical transactions to establish a baseline

        const average = stats.sum / BigInt(stats.count);
        
        // If current transaction is 3x larger than the average (remember they are negative, so we check < average * 3)
        // e.g. average = -10, amount = -40. -40 < -30 is true.
        if (average < BigInt(0) && t.amount < (average * BigInt(3))) {
             outliers.push({ transaction: t, average });
        }
    }

    return outliers;
  }

  private formatAmount(cents: bigint): string {
      const euros = Number(cents) / 100;
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(euros);
  }
}
