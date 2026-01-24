import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTransferDto {
  @IsNotEmpty()
  @IsString()
  source_account_id!: string;

  @IsNotEmpty()
  @IsString()
  destination_account_id!: string;

  @IsNotEmpty()
  @IsString()
  source_category_id!: string;

  @IsNotEmpty()
  @IsString()
  destination_category_id!: string;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}