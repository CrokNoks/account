import { Injectable, Inject } from '@nestjs/common';
import type { SmartRuleRepository } from '../domain/smart-rule.repository.interface';

@Injectable()
export class MatchSmartRulesUseCase {
  constructor(
    @Inject('SmartRuleRepository')
    private readonly ruleRepository: SmartRuleRepository,
  ) {}

  async execute(
    accountId: string,
    description: string,
  ): Promise<{ categoryId: string | null; tagIds: string[] }> {
    const rules = await this.ruleRepository.findAllByAccount(accountId);

    // Sort by priority (higher first)
    const sortedRules = rules.sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.matches(description)) {
        return {
          categoryId: rule.categoryId,
          tagIds: rule.tagIds,
        };
      }
    }

    return { categoryId: null, tagIds: [] };
  }
}
