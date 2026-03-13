# 💰 Account V2 - Project Context

## 🎯 Vision & Objectif
Refonte complète de l'application de gestion de budget et de comptes bancaires personnels. L'objectif est de remplacer la version actuelle en production par une base de code plus saine, robuste et maintenable, en éliminant la dette technique et les bugs de la V1.

- **Cible** : Usage personnel uniquement.
- **Approche** : Qualité logicielle maximale pour garantir la fiabilité des données financières.

## 🛠 Stack Technique
- **Frontend** : Next.js
- **Backend** : NestJS
- **Base de données** : Supabase (PostgreSQL)
- **Principes de Design** : 
    - **Clean Architecture** : Séparation stricte du Domaine, de l'Application (Use Cases) et de l'Infrastructure.
    - **TDD (Test Driven Development)** : Aucun code métier sans test préalable.
    - **Type Safety** : TypeScript strict.

## 💶 Gestion Monétaire
- **Format** : Toutes les valeurs monétaires sont stockées et manipulées sous forme d'**entiers** (ex: `1030` pour représenter 10,30 €). 
- **Règle** : Les calculs et le stockage se font systématiquement en centimes pour garantir une précision absolue.

## 🚀 Fonctionnalités Clés (Scope V2)
1. **Gestion des Comptes** : Création, édition et suivi des soldes des différents comptes bancaires.
2. **Gestion du Budget** : Système de templates de budget pour définir des objectifs mensuels/périodiques.
3. **Gestion des Opérations** : Saisie, catégorisation et historique des transactions financières.

## 🏗 État du Projet & Priorités
- **Phase actuelle** : Refonte du Backend.
- **Focus immédiat** : Mise en place de l'architecture socle du backend NestJS et implémentation des premiers Use Cases via le TDD.

## 📜 Règles de Développement (Engineering Standards)
1. **Domain-Driven** : Le code du domaine ne doit avoir aucune dépendance vers des frameworks externes (NestJS, TypeORM, etc.).
2. **Tests** : 
    - Tests unitaires obligatoires pour la logique métier (Domaine & Use Cases).
    - Tests d'intégration pour les adaptateurs d'infrastructure (Repositories, Supabase).
3. **Validation** : Validation stricte des entrées via DTOs et utilisation de Value Objects pour les concepts métier (ex: `Amount`).
4. **Documentation API** : Chaque route doit posséder une documentation **Swagger/OpenAPI** complète (auto-générée via le module `@nestjs/swagger`).
5. **Validation Obligatoire** : Pour chaque modification du backend, les étapes suivantes doivent être validées avec succès :
    - Exécution de tous les tests (`npm test`).
    - Lancement du serveur de développement sans erreur (`npm run start:dev`).
    - Réussite du build de production (`npm run build`).
    - Le code est conforme au norme (`npm run lint`).
    - Une tâche est considérée comme terminée uniquement lorsque ces quatres étapes sont validées.
6. **Commit** : Ne jamais commit sans instruction direct. Si l'utilisateur donne l'ordre de commiter : 
    - tirer une branche de main après avoir mis main à jour SI et SEULEMENT SI on est sur la branche main
    - donner un nom cohérent et en lien avec les modification en cours.
    - grouper les modifications en plusieurs commit en fonction  de leur impact

## Autres points
1. Informe l'utilisateur lorsque tu as chargé correctement ce fichier et les skills du projet.