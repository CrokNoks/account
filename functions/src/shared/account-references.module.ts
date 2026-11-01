import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';
import { PeriodRepositoryModule } from '../periods/period-repository.module';
import { AccountReferencesService } from './application/account-references.service';

@Module({
  imports: [CategoriesModule, TagsModule, PeriodRepositoryModule],
  providers: [AccountReferencesService],
  exports: [AccountReferencesService],
})
export class AccountReferencesModule {}
