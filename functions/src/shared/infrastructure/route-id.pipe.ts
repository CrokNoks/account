import {
  ArgumentMetadata,
  ParseUUIDPipe,
  PipeTransform,
  ValidationPipe,
} from '@nestjs/common';

/** Nom d'un paramètre de route qui porte un identifiant : `id`, `accountId`, `periodId`, `tagId`, `userId`... */
export const ROUTE_ID_PARAM = /^(id|[a-zA-Z]+Id)$/;

/**
 * Pipe global : tout paramètre de route (`@Param`) dont le nom est `id` ou finit par `Id`
 * doit être un UUID (les colonnes correspondantes sont de type `uuid` en base), sinon 400
 * avant tout appel au repository. Une nouvelle route est couverte sans rien écrire.
 */
export class RouteIdPipe implements PipeTransform<string, Promise<string>> {
  private readonly uuid = new ParseUUIDPipe();

  transform(value: string, metadata: ArgumentMetadata): Promise<string> {
    if (
      metadata.type === 'param' &&
      metadata.data &&
      ROUTE_ID_PARAM.test(metadata.data)
    ) {
      return this.uuid.transform(value, metadata);
    }
    return Promise.resolve(value);
  }
}

/** Pipes globaux de l'application (partagés par main.ts et les tests e2e). */
export const globalPipes = () => [
  new RouteIdPipe(),
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
];
