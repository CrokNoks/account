import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { ForbiddenError } from '../../shared/domain/errors';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { proposedAmountForConfigScreen } from '../../budgets/domain/proposed-amount';

export interface BudgetTemplateView {
  categoryId: string;
  name: string;
  amount: string;
  isProposal: boolean;
}

/**
 * Écran de configuration : toutes les catégories du compte avec leur montant fixe,
 * ou à défaut la somme de leurs récurrentes (proposition, jamais enregistrée ici).
 */
@Injectable()
export class GetBudgetTemplatesUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly recurringRepository: RecurringTransactionRepository,
  ) {}

  async execute(accountId: string): Promise<BudgetTemplateView[]> {
    // La RLS ne renvoie pas un compte auquel l'appelant n'a pas accès : refus explicite (403).
    if (!(await this.accountRepository.findById(accountId))) {
      throw new ForbiddenError('No access to this account');
    }
    const [templates, categories, recurring] = await Promise.all([
      this.budgetRepository.findTemplatesByAccount(accountId),
      this.categoryRepository.findAllByAccount(accountId),
      this.recurringRepository.findAllByAccount(accountId),
    ]);
    const configured = new Map(templates.map((t) => [t.categoryId, t.amount]));

    return categories.map((cat) => {
      const amount = configured.get(cat.id);
      const recurringAmounts = recurring
        .filter((r) => r.categoryId === cat.id)
        .map((r) => r.amount);
      const proposed = proposedAmountForConfigScreen(amount, recurringAmounts);
      return {
        categoryId: cat.id,
        name: cat.name,
        amount: proposed.toString(),
        isProposal: (amount === undefined || amount === 0n) && proposed !== 0n,
      };
    });
  }
}
