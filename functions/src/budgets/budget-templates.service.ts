import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface CreateBudgetTemplateDto {
  account_id: string;
  category_id: string;
  amount_base: number;
  is_fixed: boolean;
}

export interface UpdateBudgetTemplateDto {
  amount_base?: number;
  is_fixed?: boolean;
}

@Injectable()
export class BudgetTemplatesService {
  constructor(private readonly supabase: SupabaseService) { }

  async findAll(accountId: string, token: string) {
    const { data, error } = await this.supabase
      .getClientWithToken(token)
      .from('budget_templates')
      .select('*')
      .eq('account_id', accountId);

    if (error) throw new Error(error.message);
    return data;
  }

  async findOne(id: string, token: string) {
    const { data, error } = await this.supabase
      .getClientWithToken(token)
      .from('budget_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Template not found');
    return data;
  }

  async create(createBudgetTemplateDto: CreateBudgetTemplateDto, token: string) {
    const { data, error } = await this.supabase
      .getClientWithToken(token)
      .from('budget_templates')
      .insert(createBudgetTemplateDto)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, updateBudgetTemplateDto: UpdateBudgetTemplateDto, token: string) {
    const { data, error } = await this.supabase
      .getClientWithToken(token)
      .from('budget_templates')
      .update(updateBudgetTemplateDto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async remove(id: string, token: string) {
    const { error } = await this.supabase
      .getClientWithToken(token)
      .from('budget_templates')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
  }
}
