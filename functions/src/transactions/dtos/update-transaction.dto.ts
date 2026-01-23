import { IsUUID, IsOptional, IsString, IsObject } from 'class-validator'

/**
 * DTO for updating a transaction
 * @class UpdateTransactionDto
 */
export class UpdateTransactionDto {
  /**
   * Update description
   */
  @IsOptional()
  @IsString()
  description?: string

  /**
   * Update notes
   */
  @IsOptional()
  @IsString()
  notes?: string

  /**
   * Update category
   */
  @IsOptional()
  @IsUUID()
  category_id?: string

  /**
   * Update payment method
   */
  @IsOptional()
  @IsUUID()
  payment_method_id?: string

  /**
   * Update reconciliation status
   */
  @IsOptional()
  reconciliation_status?: 'pending' | 'confirmed' | 'reconciled' | 'disputed'

  /**
   * Reason for status change (stored in metadata)
   */
  @IsOptional()
  @IsString()
  reconciliation_reason?: string

  /**
   * Update metadata
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
