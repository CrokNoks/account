import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { PreferencesController } from './infrastructure/preferences.controller';
import { GetUserPreferencesUseCase } from './application/get-user-preferences.use-case';
import { UpdateUserPreferencesUseCase } from './application/update-user-preferences.use-case';
import { SupabaseUserPreferencesRepository } from './infrastructure/supabase-user-preferences.repository';

@Module({
  imports: [SupabaseModule],
  controllers: [PreferencesController],
  providers: [
    GetUserPreferencesUseCase,
    UpdateUserPreferencesUseCase,
    {
      provide: 'UserPreferencesRepository',
      useClass: SupabaseUserPreferencesRepository,
    },
  ],
  exports: [GetUserPreferencesUseCase],
})
export class PreferencesModule {}
