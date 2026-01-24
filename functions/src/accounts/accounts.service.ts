import { Injectable } from '@nestjs/common';
import { BaseService } from '../shared/base.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { SupabaseService } from '../supabase/supabase.service';

export interface Account {
  id: string;
  name: string;
  initial_balance?: number;
  type?: string;
  currency?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AccountsService extends BaseService {
  constructor(supabaseService: SupabaseService) {
    super(supabaseService, 'AccountsService');
  }

  async findAll(userId: string, accountId?: string): Promise<Account[]> {
    try {
      let query = this.supabase
        .getClient()
        .from('accounts')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (accountId) {
        query = query.eq('id', accountId);
      }

      const { data, error } = await query;

      if (error) {
        this.handleError(error, {
          operation: 'findAll',
          entity: 'account',
          userId
        });
      }

      return data || [];
    } catch (error) {
      this.handleError(error, {
        operation: 'findAll',
        entity: 'account',
        userId
      });
    }
  }

  async findOne(id: string, userId: string): Promise<Account> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('accounts')
        .select('*')
        .eq('id', id)
        .eq('owner_id', userId)
        .single();

      if (error) {
        this.handleError(error, {
          operation: 'findOne',
          entity: 'account',
          userId
        });
      }

      return data;
    } catch (error) {
      this.handleError(error, {
        operation: 'findOne',
        entity: 'account',
        userId
      });
    }
  }

  async create(userId: string, createAccountDto: CreateAccountDto): Promise<Account> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('accounts')
        .insert({
          ...createAccountDto,
          owner_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        this.handleError(error, {
          operation: 'create',
          entity: 'account',
          userId
        });
      }

      this.logInfo(`Account created successfully`, { 
        accountId: data.id, 
        userId,
        name: data.name 
      });

      return data;
    } catch (error) {
      this.handleError(error, {
        operation: 'create',
        entity: 'account',
        userId
      });
    }
  }

  async update(id: string, userId: string, updateAccountDto: UpdateAccountDto): Promise<Account> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('accounts')
        .update({
          ...updateAccountDto,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('owner_id', userId)
        .select()
        .single();

      if (error) {
        this.handleError(error, {
          operation: 'update',
          entity: 'account',
          userId
        });
      }

      this.logInfo(`Account updated successfully`, { 
        accountId: id, 
        userId,
        updates: Object.keys(updateAccountDto)
      });

      return data;
    } catch (error) {
      this.handleError(error, {
        operation: 'update',
        entity: 'account',
        userId
      });
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .getClient()
        .from('accounts')
        .delete()
        .eq('id', id)
        .eq('owner_id', userId);

      if (error) {
        this.handleError(error, {
          operation: 'remove',
          entity: 'account',
          userId
        });
      }

      this.logInfo(`Account deleted successfully`, { accountId: id, userId });
    } catch (error) {
      this.handleError(error, {
        operation: 'remove',
        entity: 'account',
        userId
      });
    }
  }
}
