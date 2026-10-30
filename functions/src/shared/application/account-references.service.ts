import { Inject, Injectable } from '@nestjs/common';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { TagRepository } from '../../tags/domain/tag.repository.interface';
import type { SavingsGoalRepository } from '../../savings-goals/domain/savings-goal.repository.interface';
import { DomainValidationError } from '../domain/errors';

export interface AccountReferences {
  categoryId?: string | null;
  tagIds?: string[] | null;
  savingsGoalId?: string | null;
}

/**
 * Règle unique : une catégorie, une étiquette ou un objectif d'épargne
 * référencé par un élément d'un compte doit appartenir à CE compte (400 sinon,
 * avant toute écriture). Une catégorie globale (sans compte) est refusée : la
 * base ne l'expose à personne (RLS `has_account_access(account_id)`), le front
 * ne charge que les catégories d'un compte.
 */
@Injectable()
export class AccountReferencesService {
  constructor(
    @Inject(CategoryRepository)
    private readonly categories: CategoryRepository,
    @Inject(TagRepository)
    private readonly tags: TagRepository,
    @Inject('SavingsGoalRepository')
    private readonly savingsGoals: SavingsGoalRepository,
  ) {}

  async ensureCategories(
    accountId: string,
    categoryIds: Array<string | null | undefined>,
  ): Promise<void> {
    for (const id of new Set(categoryIds)) {
      if (!id) continue;
      const category = await this.categories.findById(id);
      if (!category || category.accountId !== accountId) {
        throw new DomainValidationError(
          'Category does not belong to this account',
        );
      }
    }
  }

  async ensureTags(
    accountId: string,
    tagIds: string[] | null | undefined,
  ): Promise<void> {
    for (const id of new Set(tagIds ?? [])) {
      const tag = await this.tags.findById(id);
      if (!tag || tag.accountId !== accountId) {
        throw new DomainValidationError('Tag does not belong to this account');
      }
    }
  }

  async ensureSavingsGoal(
    accountId: string,
    savingsGoalId: string | null | undefined,
  ): Promise<void> {
    if (!savingsGoalId) return;
    const goal = await this.savingsGoals.findById(savingsGoalId);
    if (!goal || goal.accountId !== accountId) {
      throw new DomainValidationError(
        'Savings goal does not belong to this account',
      );
    }
  }

  async ensureReferences(
    accountId: string,
    refs: AccountReferences,
  ): Promise<void> {
    await this.ensureCategories(accountId, [refs.categoryId]);
    await this.ensureTags(accountId, refs.tagIds);
    await this.ensureSavingsGoal(accountId, refs.savingsGoalId);
  }
}
