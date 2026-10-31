import { isISO8601, ValidateBy, ValidationOptions } from 'class-validator';

/**
 * Date ISO 8601 (`YYYY-MM-DD`, avec ou sans heure/fuseau) dont le jour existe
 * au calendrier. Remplace `@IsDateString()`, qui accepte `2026-02-30` (que
 * `parseDateOnly` déborde ensuite sur le 2 mars).
 */
export const IsCalendarDate = (
  options?: ValidationOptions,
): PropertyDecorator =>
  ValidateBy(
    {
      name: 'isCalendarDate',
      validator: {
        validate: (value) =>
          typeof value === 'string' &&
          /^\d{4}-\d{2}-\d{2}/.test(value) &&
          isISO8601(value, { strict: true }),
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} must be a valid ISO 8601 date existing on the calendar`,
      },
    },
    options,
  );
