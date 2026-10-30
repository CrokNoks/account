---
name: nestjs
description: Conventions NestJS + TypeScript pour implémenter ou relire du code back (modules, DTO, guards, transactions, tests). À charger dès qu'on touche au back NestJS.
---

# Conventions NestJS

## Structure
- Un module par domaine métier (`auctions/`, `listings/`) : `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `*.spec.ts`.
- Les règles métier dans des fonctions ou classes pures, testables sans Nest ; le service orchestre, le controller ne contient aucune logique.
- Dépendances externes derrière un token (`@Inject(TOKEN)`) quand on veut les remplacer en test.

## Entrées et sécurité
- DTO avec `class-validator` ; `ValidationPipe({ whitelist: true, transform: true })` global.
- Autorisation par guards (`@UseGuards`), rôles via `SetMetadata` + `Reflector`.
- Erreurs : exceptions Nest (`NotFoundException`, `ConflictException`…), jamais de `throw new Error` exposé tel quel.

## Données
- Requêtes paramétrées uniquement (ORM ou `$1`), jamais d'interpolation.
- Montants en centimes (`integer`), jamais en `float`.
- Plusieurs écritures liées = une transaction.
- Mises à jour concurrentes : `UPDATE … SET x = x + $1`, verrou (`SELECT … FOR UPDATE`) ou version optimiste.

- TypeORM : une relation `@ManyToOne` n'ajoute **pas** de champ `xxxId` sur l'entité chargée. Charge la relation (`relations: ['author']`) et lis `entite.author.id`, ou déclare `@RelationId` / `@Column`. Les chaînes SQL du query builder (`article.authorId`) parlent de la colonne, pas de l'objet. Par défaut, TypeORM garde le nom de la propriété comme nom de colonne (`commentId`, `createdAt` ; pas de snake_case sans `NamingStrategy`) : une requête de mesure donnée à quelqu'un doit avoir été exécutée.

## Tests
- Unitaires sur les règles métier pures (Jest), sans Nest.
- `Test.createTestingModule()` + `overrideProvider()` pour les services.
- e2e avec `supertest` sur les endpoints critiques.
- Des faux dépôts ne prouvent pas un accès aux données : pour une règle d'accès ou de visibilité, vérifie aussi en réel (application lancée, `curl` en auteur, en autre utilisateur, en anonyme).

## Rappels
- Cycle d'une requête : middleware → guards → interceptors → pipes → handler → interceptors → filters.
- NestJS 11 : Express 5 par défaut (syntaxe des wildcards de routes modifiée).
