import { Injectable } from '@nestjs/common';
import { BaseService } from '../shared/base.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { SupabaseService } from '../supabase/supabase.service';

export interface PaymentMethod {
  id: string;
  name: string;
  type?: string;
  provider?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PaymentMethodsService extends BaseService {
  constructor(supabaseService: SupabaseService) {
    super(supabaseService, 'PaymentMethodsService');
  }

  async findAll(): Promise<PaymentMethod[]> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('payment_methods')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        this.handleError(error, {
          operation: 'findAll',
          entity: 'payment method'
        });
      }

      return data || [];
    } catch (error) {
      this.handleError(error, {
        operation: 'findAll',
        entity: 'payment method'
      });
    }
  }

  async findOne(id: string): Promise<PaymentMethod> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('payment_methods')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        this.handleError(error, {
          operation: 'findOne',
          entity: 'payment method'
        });
      }

      return data;
    } catch (error) {
      this.handleError(error, {
        operation: 'findOne',
        entity: 'payment method'
      });
    }
  }

  async create(createPaymentMethodDto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('payment_methods')
        .insert({
          ...createPaymentMethodDto,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        this.handleError(error, {
          operation: 'create',
          entity: 'payment method'
        });
      }

      const result = data!;
      this.logInfo(`Payment method created successfully`, { 
        paymentMethodId: result.id, 
        name: result.name,
        type: result.type
      });

      return result;
    } catch (error) {
      this.handleError(error, {
        operation: 'create',
        entity: 'payment method'
      });
    }
  }

  async update(id: string, updatePaymentMethodDto: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('payment_methods')
        .update({
          ...updatePaymentMethodDto,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.handleError(error, {
          operation: 'update',
          entity: 'payment method'
        });
      }

      const result = data!;
      this.logInfo(`Payment method updated successfully`, { 
        paymentMethodId: id, 
        updates: Object.keys(updatePaymentMethodDto)
      });

      return result;
    } catch (error) {
      this.handleError(error, {
        operation: 'update',
        entity: 'payment method'
      });
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .getClient()
        .from('payment_methods')
        .delete()
        .eq('id', id);

      if (error) {
        this.handleError(error, {
          operation: 'remove',
          entity: 'payment method'
        });
      }

      this.logInfo(`Payment method deleted successfully`, { paymentMethodId: id });
    } catch (error) {
      this.handleError(error, {
        operation: 'remove',
        entity: 'payment method'
      });
    }
  }
}
