import { Category } from './category.entity';

export abstract class CategoryRepository {
  abstract findAllByAccount(accountId: string): Promise<Category[]>;
  abstract findById(id: string): Promise<Category | null>;
  abstract save(category: Category): Promise<void>;
  /**
   * Marque (ou retire la marque de) la catégorie « déclencheur de période » ;
   * marquer une catégorie retire la marque de celle du même compte, dans la même
   * transaction. Catégorie introuvable (autre compte comprise) : `NotFoundError` ;
   * lecture seule : `ForbiddenError`.
   */
  abstract setPeriodTrigger(id: string, value: boolean): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
