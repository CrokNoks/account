import { ValidateBy, ValidationOptions } from 'class-validator';
import { isCentsString } from '../domain/cents';

/** Montant en centimes entiers (chaîne), dans les bornes d'un bigint signé 64 bits. */
export const IsCents = (options?: ValidationOptions): PropertyDecorator =>
  ValidateBy(
    {
      name: 'isCents',
      validator: {
        validate: (value) => isCentsString(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} must be an integer amount in cents (signed 64-bit)`,
      },
    },
    options,
  );
