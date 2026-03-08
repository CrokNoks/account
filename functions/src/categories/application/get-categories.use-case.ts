import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../domain/category.repository.interface';
import { Category } from '../domain/category.entity';

@Injectable()
export class GetCategoriesUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(accountId: string): Promise<Category[]> {
    return this.categoryRepository.findAllByAccount(accountId);
  }
}
