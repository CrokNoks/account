import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { TagRepository } from '../../tags/domain/tag.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';

export interface TagSummary {
  tagId: string;
  name: string;
  color: string;
  totalAmount: string;
  transactionCount: number;
}

@Injectable()
export class GetTagsSummaryUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly tagRepository: TagRepository,
    private readonly periodRepository: PeriodRepository,
  ) {}

  async execute(accountId: string, periodId?: string): Promise<TagSummary[]> {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (periodId) {
      const period = await this.periodRepository.findById(periodId);
      if (period) {
        startDate = period.startDate;
        endDate = period.endDate || undefined;
      }
    }

    const transactions = await this.transactionRepository.findAllByAccount(
      accountId,
      { startDate, endDate },
    );
    const tags = await this.tagRepository.findAllByAccount(accountId);

    const tagStats = new Map<string, { total: bigint; count: number }>();

    for (const t of transactions) {
      if (t.tagIds && t.tagIds.length > 0) {
        for (const tagId of t.tagIds) {
          const stats = tagStats.get(tagId) || { total: BigInt(0), count: 0 };
          stats.total += t.amount;
          stats.count += 1;
          tagStats.set(tagId, stats);
        }
      }
    }

    return tags
      .map((tag) => {
        const stats = tagStats.get(tag.id) || { total: BigInt(0), count: 0 };
        return {
          tagId: tag.id,
          name: tag.name,
          color: tag.color || '#94a3b8',
          totalAmount: stats.total.toString(),
          transactionCount: stats.count,
        };
      })
      .sort((a, b) => {
        // Sort by absolute total amount (most significant first)
        const absA =
          BigInt(a.totalAmount) < BigInt(0)
            ? -BigInt(a.totalAmount)
            : BigInt(a.totalAmount);
        const absB =
          BigInt(b.totalAmount) < BigInt(0)
            ? -BigInt(b.totalAmount)
            : BigInt(b.totalAmount);
        return absA > absB ? -1 : 1;
      });
  }
}
