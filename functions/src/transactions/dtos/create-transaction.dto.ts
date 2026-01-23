import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsDate,
  IsObject,
  Min,
  Length,
} from 'class-validator'
import { Type } from 'class-transformer'

/**
 * DTO for creating a new transaction
 * @class CreateTransactionDto
 */
export class CreateTransactionDto {
  /**
   * Account ID - must have write permission
   */
  @IsUUID()
  account_id!: string

  /**
   * Transaction type: expense, income, transfer, or adjustment
   */
  @IsEnum(['expense', 'income', 'transfer', 'adjustment'])
  type!: 'expense' | 'income' | 'transfer' | 'adjustment'

  /**
   * Transaction amount in account currency
   * @example 25.99
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number

  /**
   * Currency code (ISO 4217)
   * @default 'EUR'
   */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string

  /**
   * Transaction date
   */
  @IsDate()
  @Type(() => Date)
  date!: Date

  /**
   * Human-readable description
   */
  @IsString()
  @Length(1, 500)
  description!: string

  /**
   * Additional notes
   */
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string

  /**
   * Category ID (optional, auto-assigned by rules)
   */
  @IsOptional()
  @IsUUID()
  category_id?: string

  /**
   * Period ID (optional, auto-assigned by trigger)
   */
  @IsOptional()
  @IsUUID()
  period_id?: string

  /**
   * Payment method ID
   */
  @IsOptional()
  @IsUUID()
  payment_method_id?: string

  /**
   * For transfer type: linked transaction in destination account
   */
  @IsOptional()
  @IsUUID()
  linked_transaction_id?: string

  /**
   * Initial reconciliation status
   * @default 'pending'
   */
  @IsOptional()
  @IsEnum(['pending', 'confirmed', 'reconciled'])
  reconciliation_status?: string

  /**
   * Flexible metadata storage
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
