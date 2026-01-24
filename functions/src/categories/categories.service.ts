import { Injectable } from '@nestjs/common';
import { BaseService } from '../shared/base.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SupabaseService } from '../supabase/supabase.service';

export interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  account_id?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class CategoriesService extends BaseService {
  constructor(supabaseService: SupabaseService) {
    super(supabaseService, 'CategoriesService');
  }

  async findAll(userId: string, accountId?: string): Promise<Category[]> {
    try {
      let query = this.supabase
        .getClient()
        .from('categories')
        .select('*')
        .order('created_at', { ascending: false });

      if (accountId) {
        query = query.eq('account_id', accountId);
      } else {
        // If no specific account, get categories for all user's accounts
        const { data: accounts } = await this.supabase
          .getClient()
          .from('accounts')
          .select('id')
          .eq('owner_id', userId);
        
        if (accounts && accounts.length > 0) {
          const accountIds = accounts.map(acc => acc.id);
          query = query.in('account_id', accountIds);
        }
      }

      const { data, error } = await query;

      if (error) {
        this.handleError(error, {
          operation: 'findAll',
          entity: 'category',
          userId
        });
      }

      return data || [];
    } catch (error) {
      this.handleError(error, {
        operation: 'findAll',
        entity: 'category',
        userId
      });
    }
  }

  async findOne(id: string, userId: string): Promise<Category> {
    try {
      // First verify user owns the category through account ownership
      const { data: category, error } = await this.supabase
        .getClient()
        .from('categories')
        .select(`
          *,
          accounts!inner(owner_id)
        `)
        .eq('id', id)
        .eq('accounts.owner_id', userId)
        .single();

      if (error) {
        this.handleError(error, {
          operation: 'findOne',
          entity: 'category',
          userId
        });
      }

      return category;
    } catch (error) {
      this.handleError(error, {
        operation: 'findOne',
        entity: 'category',
        userId
      });
    }
  }

  async create(userId: string, createCategoryDto: CreateCategoryDto): Promise<Category> {
    try {
      // If account_id is provided, verify user owns the account
      if (createCategoryDto.account_id) {
        const { data: account } = await this.supabase
          .getClient()
          .from('accounts')
          .select('id')
          .eq('id', createCategoryDto.account_id)
          .eq('owner_id', userId)
          .single();

        if (!account) {
          this.handleError(new Error('Account not found or access denied'), {
            operation: 'create',
            entity: 'category',
            userId
          });
        }
      }

      const { data, error } = await this.supabase
        .getClient()
        .from('categories')
        .insert({
          ...createCategoryDto,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        this.handleError(error, {
          operation: 'create',
          entity: 'category',
          userId
        });
      }

      const result = data!;
      this.logInfo(`Category created successfully`, { 
        categoryId: result.id, 
        userId,
        name: result.name,
        account_id: result.account_id
      });

      return result;
    } catch (error) {
      this.handleError(error, {
        operation: 'create',
        entity: 'category',
        userId
      });
    }
  }

  async update(id: string, userId: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    try {
      // Verify user owns the category through account ownership
      const existingCategory = await this.findOne(id, userId);

      if (!existingCategory) {
        this.handleError(new Error('Category not found or access denied'), {
          operation: 'update',
          entity: 'category',
          userId
        });
      }

      // If updating account_id, verify new account ownership
      if (updateCategoryDto.account_id) {
        const { data: account } = await this.supabase
          .getClient()
          .from('accounts')
          .select('id')
          .eq('id', updateCategoryDto.account_id)
          .eq('owner_id', userId)
          .single();

        if (!account) {
          this.handleError(new Error('Target account not found or access denied'), {
            operation: 'update',
            entity: 'category',
            userId
          });
        }
      }

      const { data, error } = await this.supabase
        .getClient()
        .from('categories')
        .update({
          ...updateCategoryDto,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.handleError(error, {
          operation: 'update',
          entity: 'category',
          userId
        });
      }

      const result = data!;
      this.logInfo(`Category updated successfully`, { 
        categoryId: id, 
        userId,
        updates: Object.keys(updateCategoryDto)
      });

      return result;
    } catch (error) {
      this.handleError(error, {
        operation: 'update',
        entity: 'category',
        userId
      });
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
      // Verify user owns the category through account ownership
      const existingCategory = await this.findOne(id, userId);

      if (!existingCategory) {
        this.handleError(new Error('Category not found or access denied'), {
          operation: 'remove',
          entity: 'category',
          userId
        });
      }

      const { error } = await this.supabase
        .getClient()
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) {
        this.handleError(error, {
          operation: 'remove',
          entity: 'category',
          userId
        });
      }

      this.logInfo(`Category deleted successfully`, { categoryId: id, userId });
    } catch (error) {
      this.handleError(error, {
        operation: 'remove',
        entity: 'category',
        userId
      });
    }
  }
}
