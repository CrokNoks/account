import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../domain/category.repository.interface';
import { Category, CategoryType } from '../domain/category.entity';

export interface CreateCategoryCommand {
  name: string;
  description?: string | null;
  color: string;
  type: CategoryType;
  accountId: string;
  budget?: bigint | null;
}

@Injectable()
export class CreateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(command: CreateCategoryCommand): Promise<Category> {
    const category = Category.create({
      name: command.name,
      description: command.description,
      color: command.color,
      type: command.type,
      accountId: command.accountId,
      budget: command.budget,
    });

    await this.categoryRepository.save(category);
    return category;
  }
}
