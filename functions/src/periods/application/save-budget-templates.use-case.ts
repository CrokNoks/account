import { Injectable } from '@nestjs/common';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { DomainValidationError } from '../../shared/domain/errors';

export interface SaveBudgetTemplatesCommand {
  accountId: string;
  items: Array<{ categoryId: string; amount: bigint }>;
}

/**
 * Enregistre les montants fixes du compte. Tout ou rien : les catégories sont
 * vérifiées avant toute écriture (une catégorie supprimée ou d'un autre compte
 * refuse tout le lot), puis un seul upsert écrit toutes les lignes.
 */
@Injectable()
export class SaveBudgetTemplatesUseCase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly references: AccountReferencesService,
  ) {}

  async execute(command: SaveBudgetTemplatesCommand): Promise<void> {
    const ids = command.items.map((i) => i.categoryId);
    if (new Set(ids).size !== ids.length) {
      throw new DomainValidationError('Duplicate category in budget templates');
    }
    await this.references.ensureCategories(command.accountId, ids);
    await this.budgetRepository.saveTemplates(
      command.accountId,
      command.items.map((i) => ({
        categoryId: i.categoryId,
        amount: i.amount,
      })),
    );
  }
}
