import { Category } from './category.entity';

export abstract class CategoryRepository {
  abstract findAllByAccount(accountId: string): Promise<Category[]>;
  abstract findById(id: string): Promise<Category | null>;
  abstract save(category: Category): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
