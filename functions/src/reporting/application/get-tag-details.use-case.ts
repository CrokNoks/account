import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { TagRepository } from '../../tags/domain/tag.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { TagSummary } from './get-tags-summary.use-case';

export interface TagCategoryBreakdown {
  categoryId: string | null;
  name: string;
  amount: string;
  percentage: number;
}

export interface TagRecentTransaction {
  id: string;
  description: string;
  date: string;
  amount: string;
}

export interface TagDetails {
  summary: TagSummary;
  categoryBreakdown: TagCategoryBreakdown[];
  recentTransactions: TagRecentTransaction[];
}

@Injectable()
export class GetTagDetailsUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly tagRepository: TagRepository,
    private readonly periodRepository: PeriodRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(
    accountId: string,
    tagId: string,
    periodId?: string,
  ): Promise<TagDetails> {
    const tag = await this.tagRepository.findById(tagId);
    if (!tag || tag.accountId !== accountId) throw new Error('Tag not found');

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (periodId) {
      const period = await this.periodRepository.findById(periodId);
      if (period) {
        startDate = period.startDate;
        endDate = period.endDate || undefined;
      }
    }

    const allTransactions = await this.transactionRepository.findAllByAccount(
      accountId,
      { startDate, endDate },
    );
    const tagTransactions = allTransactions.filter((t) =>
      t.tagIds?.includes(tagId),
    );

    const categories =
      await this.categoryRepository.findAllByAccount(accountId);

    // Calculate Summary
    const totalAmount = tagTransactions.reduce(
      (sum, t) => sum + t.amount,
      BigInt(0),
    );
    const summary: TagSummary = {
      tagId: tag.id,
      name: tag.name,
      color: tag.color || '#94a3b8',
      totalAmount: totalAmount.toString(),
      transactionCount: tagTransactions.length,
    };

    // Calculate Category Breakdown
    const amountByCategory = new Map<string | null, bigint>();
    for (const t of tagTransactions) {
      const catId = t.categoryId || null;
      const current = amountByCategory.get(catId) || BigInt(0);
      amountByCategory.set(catId, current + t.amount);
    }

    const totalAbsAmount = tagTransactions.reduce(
      (sum, t) => sum + (t.amount < 0 ? -t.amount : t.amount),
      BigInt(0),
    );

    const categoryBreakdown: TagCategoryBreakdown[] = [];
    for (const [catId, amount] of amountByCategory.entries()) {
      const category = categories.find((c) => c.id === catId);
      const absAmount = amount < 0 ? -amount : amount;
      const percentage =
        totalAbsAmount > BigInt(0)
          ? Math.round(Number((absAmount * BigInt(100)) / totalAbsAmount))
          : 0;

      categoryBreakdown.push({
        categoryId: catId,
        name: category?.name || 'Uncategorized',
        amount: amount.toString(),
        percentage,
      });
    }

    // Sort by absolute amount
    categoryBreakdown.sort((a, b) => {
      const absA =
        BigInt(a.amount) < BigInt(0) ? -BigInt(a.amount) : BigInt(a.amount);
      const absB =
        BigInt(b.amount) < BigInt(0) ? -BigInt(b.amount) : BigInt(b.amount);
      return absA > absB ? -1 : 1;
    });

    // Recent Transactions
    const recentTransactions: TagRecentTransaction[] = tagTransactions
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5)
      .map((tx) => ({
        id: tx.id,
        description: tx.description,
        date: tx.date.toISOString(),
        amount: tx.amount.toString(),
      }));

    return {
      summary,
      categoryBreakdown,
      recentTransactions,
    };
  }
}
