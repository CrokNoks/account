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
    - Une tâche est considérée comme terminée uniquement lorsque ces trois étapes sont validées.

### État d'Avancement
#### Backend (NestJS)
1. [DONE] Setup CONTEXT.md et Engineering Standards.
2. [DONE] Créer script SQL de migration sécurisée (V2).
3. [DONE] Initialiser NestJS avec Clean Architecture et Auth.
4. [DONE] Implémenter le domaine "Accounts" et Swagger.
5. [DONE] Générer `supabase/seed.sql` compatible V2 à partir de `data.sql`.
6. [DONE] Configurer l'environnement local (.env) du backend.
7. [DONE] Implémenter le domaine "Categories" (TDD).
8. [DONE] Implémenter le domaine "Transactions" (TDD).
9. [DONE] Implémenter le domaine "Budgets" (Périodes & Saisie Analytique).
10. [DONE] Implémenter le module "Reporting".
11. [TODO] Déployer sur Firebase Functions.

#### Frontend (Next.js)
1. [DONE] Initialiser Next.js avec Tailwind, shadcn/ui, et React Query (FSD).
2. [DONE] Mettre en place l'authentification Supabase et la gestion de session.
3. [DONE] Créer la navigation principale et le layout (Sidebar/Topbar/Header).
4. [DONE] Implémenter la feature "Accounts" (Liste et Création).
5. [DONE] Implémenter la feature "Periods" (Workflow draft intelligent).
6. [DONE] Implémenter la feature "Transactions" (Liste, Filtres, Pointage, Suppression).
7. [DONE] Implémenter la feature "Categories" (Liste, Couleurs, Templates).
8. [DONE] Implémenter le Dashboard (Stats de période & Breakdown budgétaire).
9. [DONE] Ajouter le feedback utilisateur (Toasts avec Sonner).
10. [DONE] Valider le build de production global.

#### Prochaines Étapes (Optionnel)
- [ ] Ajouter des graphiques de visualisation (Charts).
- [ ] Implémenter l'édition complète des entités (Comptes, Catégories).
- [ ] Configurer le déploiement sur Firebase.

