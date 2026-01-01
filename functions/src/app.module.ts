import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { BudgetsModule } from './budgets/budgets.module';
import { PeriodsModule } from './periods/periods.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve(process.cwd(), '../.env'),
      isGlobal: true, // Makes ConfigService available everywhere
    }),
    SupabaseModule,
    BudgetsModule,
    PeriodsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
