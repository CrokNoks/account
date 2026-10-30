---
name: nextjs
description: Conventions Next.js App Router pour le front (Server/Client Components, rendu, Server Actions, appels à l'API NestJS). À charger dès qu'on touche au front Next.js.
---

# Conventions Next.js (App Router)

## Principes
- Server Components par défaut ; `"use client"` uniquement pour l'interactivité, le plus bas possible dans l'arbre.
- La logique métier reste dans l'API NestJS ; Next.js affiche et orchestre.
- Aucun secret ni import serveur dans un Client Component.

## Structure
- `app/{route}/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` ; routes dynamiques `[id]`.
- Appels API regroupés dans `lib/api/` (un client typé), pas de `fetch` éparpillés.
- Composants réutilisables dans `components/`.

## Données et rendu
- Lecture : `async` Server Component qui appelle l'API.
- Mutations : Server Action (`"use server"`) qui valide les entrées et vérifie les droits — c'est un endpoint public —, puis `revalidatePath()` ou `revalidateTag()`.
- Vérifier la version de Next.js avant de supposer un comportement de cache.

## Qualité
- Pensé mobile d'abord (les agents CapCar sont sur le terrain).
- États vides, chargement et erreur toujours traités.
- Pas d'erreur d'hydratation : pas de `Date.now()` ou `Math.random()` dans le rendu serveur.
