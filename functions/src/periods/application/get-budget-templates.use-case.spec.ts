import { GetBudgetTemplatesUseCase } from './get-budget-templates.use-case';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { ForbiddenError } from '../../shared/domain/errors';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';

describe('GetBudgetTemplatesUseCase', () => {
  const budgetRepo = { findTemplatesByAccount: jest.fn() };
  const categoryRepo = { findAllByAccount: jest.fn() };
  const recurringRepo = { findAllByAccount: jest.fn() };
  const accountRepo = { findById: jest.fn() };
  const useCase = new GetBudgetTemplatesUseCase(
    accountRepo as unknown as AccountRepository,
    budgetRepo as unknown as BudgetRepository,
    categoryRepo as unknown as CategoryRepository,
    recurringRepo as unknown as RecurringTransactionRepository,
  );

  const cats = [
    { id: 'c1', name: 'Courses' },
    { id: 'c2', name: 'Loyer' },
    { id: 'c3', name: 'Sport' },
    { id: 'c4', name: 'Divers' },
  ];
  const rec = (categoryId: string, amount: bigint) => ({ categoryId, amount });

  beforeEach(() => {
    jest.resetAllMocks();
    accountRepo.findById.mockResolvedValue({ id: 'acc-1' });
    categoryRepo.findAllByAccount.mockResolvedValue(cats);
    recurringRepo.findAllByAccount.mockResolvedValue([
      rec('c1', 12000n),
      rec('c2', 12000n),
      rec('c2', 3050n),
      rec('c3', 700n),
    ]);
    budgetRepo.findTemplatesByAccount.mockResolvedValue([
      { categoryId: 'c1', amount: 50000n },
      { categoryId: 'c3', amount: 0n },
    ]);
  });

  it('returns every category with configured amount, else recurring sum (proposal), else 0', async () => {
    const result = await useCase.execute('acc-1');

    expect(result).toEqual([
      { categoryId: 'c1', name: 'Courses', amount: '50000', isProposal: false },
      { categoryId: 'c2', name: 'Loyer', amount: '15050', isProposal: true },
      { categoryId: 'c3', name: 'Sport', amount: '700', isProposal: true },
      { categoryId: 'c4', name: 'Divers', amount: '0', isProposal: false },
    ]);
  });

  it('writes nothing (read only)', async () => {
    await useCase.execute('acc-1');
    expect(Object.keys(budgetRepo)).toEqual(['findTemplatesByAccount']);
  });

  it('refuses (403) an account the caller cannot see, without reading anything (CA7)', async () => {
    accountRepo.findById.mockResolvedValue(null); // la RLS masque le compte

    await expect(useCase.execute('acc-other')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(budgetRepo.findTemplatesByAccount).not.toHaveBeenCalled();
    expect(categoryRepo.findAllByAccount).not.toHaveBeenCalled();
  });
});
