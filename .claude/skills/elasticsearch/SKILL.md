---
name: elasticsearch
description: Conventions Elasticsearch avec NestJS pour la recherche (annonces, véhicules) — index, mapping, synchronisation avec PostgreSQL, requêtes et tests. À charger dès qu'une fonctionnalité touche la recherche ou les filtres sur de gros volumes.
---

# Conventions Elasticsearch

## Avant d'en ajouter
PostgreSQL reste la source de vérité. Elasticsearch sert à **chercher et filtrer vite** (texte libre, facettes, tri par pertinence, géolocalisation). Pour un simple filtre sur quelques milliers de lignes, un index PostgreSQL suffit.

## Index et mapping
- Un index par type de document (`listings`), avec un **alias** (`listings` → `listings_v2`) pour pouvoir réindexer sans coupure.
- Mapping explicite, jamais dynamique : `keyword` pour les filtres exacts (marque, statut, carburant), `text` avec analyseur `french` pour la recherche libre, `integer` pour `priceCents`, `km`, `year`, `geo_point` pour la localisation.
- Le document ne contient que ce qui sert à chercher, filtrer ou afficher dans la liste.

## Synchronisation avec PostgreSQL
- Écriture en base d'abord, puis indexation : via un événement (`listing.updated` dans Kafka ou event-emitter) consommé de façon idempotente (`index` avec l'id comme `_id`).
- Prévoir une commande de réindexation complète depuis PostgreSQL (rattrapage après incident).
- Accepter un léger décalage (quasi temps réel) et le dire dans la spec si le métier y est sensible.

## Requêtes
- `bool` : `filter` pour les critères exacts (pas de score, mis en cache), `must` pour le texte libre.
- Pagination par `search_after` au-delà de quelques pages, pas de `from` profond.
- Facettes avec des `aggregations` sur les champs `keyword`.

## NestJS
`@nestjs/elasticsearch` (client officiel `@elastic/elasticsearch`) dans un module `search/` ; un service de requête et un service d'indexation séparés.

## Tests
- Construction de la requête : tester la fonction qui transforme les filtres en requête ES, sans cluster.
- Intégration : un conteneur Elasticsearch dans Docker pour les cas critiques seulement.
