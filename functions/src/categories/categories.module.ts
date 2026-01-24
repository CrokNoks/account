import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, SupabaseService],
  exports: [CategoriesService]
})
export class CategoriesModule {}
