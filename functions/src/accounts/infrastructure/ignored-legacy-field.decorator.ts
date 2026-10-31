import { applyDecorators } from '@nestjs/common';
import { Exclude } from 'class-transformer';
import { Allow } from 'class-validator';

/**
 * Champ retiré mais encore envoyé par un front en cache : accepté (pas de 400) puis
 * ignoré. @Exclude l'empêche d'être copié dans le DTO, @Allow évite le 400 de la
 * whitelist sur la propriété déclarée. À réserver aux DTO concernés.
 */
export const IgnoredLegacyField = () => applyDecorators(Exclude(), Allow());
