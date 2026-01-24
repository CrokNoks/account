import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, SupabaseService],
  exports: [AccountsService]
})
export class AccountsModule {}
