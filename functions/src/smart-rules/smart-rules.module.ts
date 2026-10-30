import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseSmartRuleRepository } from './infrastructure/supabase-smart-rule.repository';
import { MatchSmartRulesUseCase } from './application/match-smart-rules.use-case';
import { AccountReferencesModule } from '../shared/account-references.module';
import { SmartRulesController } from './infrastructure/smart-rules.controller';

@Module({
  imports: [SupabaseModule, AccountReferencesModule],
  controllers: [SmartRulesController],
  providers: [
    {
      provide: 'SmartRuleRepository',
      useClass: SupabaseSmartRuleRepository,
    },
    MatchSmartRulesUseCase,
  ],
  exports: ['SmartRuleRepository', MatchSmartRulesUseCase],
})
export class SmartRulesModule {}
