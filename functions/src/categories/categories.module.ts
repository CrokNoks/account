import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CategoryRepository } from './domain/category.repository.interface';
import { SupabaseCategoryRepository } from './infrastructure/supabase-category.repository';
import { GetCategoriesUseCase } from './application/get-categories.use-case';
import { CreateCategoryUseCase } from './application/create-category.use-case';
import { CategoriesController } from './infrastructure/categories.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [CategoriesController],
  providers: [
    {
      provide: CategoryRepository,
      useClass: SupabaseCategoryRepository,
    },
    GetCategoriesUseCase,
    CreateCategoryUseCase,
  ],
  exports: [CategoryRepository, GetCategoriesUseCase, CreateCategoryUseCase],
})
export class CategoriesModule {}
