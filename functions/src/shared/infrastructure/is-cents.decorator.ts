import { ValidateBy, ValidationOptions } from 'class-validator';
import { isCentsString } from '../domain/cents';

/** Montant en centimes entiers (chaîne), dans ±(2^53 − 1). */
export const IsCents = (options?: ValidationOptions): PropertyDecorator =>
  ValidateBy(
    {
      name: 'isCents',
      validator: {
        validate: (value) => isCentsString(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} must be an integer amount in cents within ±(2^53 - 1)`,
      },
    },
    options,
  );
