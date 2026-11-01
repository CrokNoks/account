import { ValidateIf } from 'class-validator';

/**
 * Champ facultatif (peut être absent) mais jamais `null` : absent = on ne
 * touche pas, présent = les autres validateurs s'appliquent, donc `null` est
 * refusé (400). `@IsOptional()` laisse passer `null`, ce qui n'a aucun sens
 * pour un champ obligatoire en base (500 ou `null` écrit) ; à garder
 * seulement là où `null` veut dire « aucun » (catégorie, notes…).
 */
export const IsOptionalNotNull = (): PropertyDecorator =>
  ValidateIf((_object, value) => value !== undefined);
