---
name: kafka
description: Conventions Kafka avec NestJS (topics, clés, consumers idempotents, outbox, erreurs). À charger dès qu'une fonctionnalité publie ou consomme des événements.
---

# Conventions Kafka

## Avant d'en ajouter
Kafka seulement si plusieurs consommateurs indépendants, un rejeu ou un gros débit le justifient. Sinon : appel direct, `@nestjs/event-emitter` ou une file BullMQ.

## Événements
- Nom au passé, côté métier : `auction.bid_placed`, `auction.closed`.
- Clé = identifiant de l'entité (`auctionId`) pour garantir l'ordre par entité.
- Payload versionné (`version: 1`), avec `eventId` unique et `occurredAt`.

## Publication
- Pattern outbox : écrire l'événement dans une table `outbox` dans la même transaction que la donnée métier, puis le publier.
- Producer avec `acks=all` et idempotence activée.

## Consommation
- At-least-once : chaque consumer est idempotent (table des `eventId` traités, ou upsert).
- Commit de l'offset après le traitement.
- Erreurs : quelques retries, puis un topic de rejet (`*.dlt`) pour ne pas bloquer la partition.
- Un consumer group par usage (notifications, facturation…).

## NestJS
`@nestjs/microservices` avec `Transport.KAFKA` et `@EventPattern('topic')`, ou `kafkajs` directement.

## Tests
Tester le handler comme une fonction (payload en entrée → effet attendu), y compris le cas « message reçu deux fois ».
