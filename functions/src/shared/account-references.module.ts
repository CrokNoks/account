import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';
import { SavingsGoalsModule } from '../savings-goals/savings-goals.module';
import { PeriodRepositoryModule } from '../periods/period-repository.module';
import { AccountReferencesService } from './application/account-references.service';

@Module({
  imports: [
    CategoriesModule,
    TagsModule,
    SavingsGoalsModule,
    PeriodRepositoryModule,
  ],
  providers: [AccountReferencesService],
  exports: [AccountReferencesService],
})
export class AccountReferencesModule {}
