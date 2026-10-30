import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { PeriodRepository } from './domain/period.repository.interface';
import { SupabasePeriodRepository } from './infrastructure/supabase-period.repository';

/**
 * Fournit uniquement le dépôt des périodes, sans dépendre d'un autre module
 * métier : AccountReferencesModule peut l'importer sans recréer le cycle
 * PeriodsModule <-> TransactionsModule (PeriodsModule le réexporte).
 */
@Module({
  imports: [SupabaseModule],
  providers: [
    { provide: PeriodRepository, useClass: SupabasePeriodRepository },
  ],
  exports: [PeriodRepository],
})
export class PeriodRepositoryModule {}
