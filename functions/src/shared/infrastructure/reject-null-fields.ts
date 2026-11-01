import { BadRequestException } from '@nestjs/common';

/**
 * Refuse (400) un `null` sur les champs listés. Pour les DTO construits avec
 * `PartialType`, qui pose `@IsOptional()` sur chaque champ (donc laisse passer
 * `null`) et ne peut pas être corrigé champ par champ ; ailleurs, utiliser
 * `@IsOptionalNotNull()`.
 */
export function rejectNullFields<T extends object>(
  dto: T,
  fields: readonly (keyof T & string)[],
): void {
  const nulls = fields.filter((field) => dto[field] === null);
  if (nulls.length > 0) {
    throw new BadRequestException(
      nulls.map((field) => `${field} must not be null`),
    );
  }
}
