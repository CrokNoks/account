import { Inject, Injectable } from '@nestjs/common';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { TagRepository } from '../../tags/domain/tag.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { DomainValidationError } from '../domain/errors';

export interface AccountReferences {
  categoryId?: string | null;
  tagIds?: string[] | null;
  periodId?: string | null;
}

/**
 * Règle unique : une catégorie, une étiquette ou une période
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
    @Inject(PeriodRepository)
    private readonly periods: PeriodRepository,
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

  async ensurePeriod(
    accountId: string,
    periodId: string | null | undefined,
  ): Promise<void> {
    if (!periodId) return;
    const period = await this.periods.findById(periodId);
    if (!period || period.accountId !== accountId) {
      throw new DomainValidationError('Period does not belong to this account');
    }
  }

  async ensureReferences(
    accountId: string,
    refs: AccountReferences,
  ): Promise<void> {
    await this.ensureCategories(accountId, [refs.categoryId]);
    await this.ensureTags(accountId, refs.tagIds);
    await this.ensurePeriod(accountId, refs.periodId);
  }
}
