import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initial_balance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}