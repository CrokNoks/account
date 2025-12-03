# Structure du module Reports

Ce module a été refactorisé pour améliorer la maintenabilité et la lisibilité du code.

## 📁 Structure des fichiers

```
src/resources/reports/
├── ReportDashboard.tsx          # Composant principal (simplifié)
├── CategoryEvolution.tsx        # Évolution des catégories
├── components/                  # Composants UI réutilisables
│   ├── index.ts                # Exports des composants
│   ├── ReportSummaryCards.tsx  # Cartes de résumé financier
│   ├── ReportSelector.tsx      # Sélecteur de rapport
│   ├── CreateReportModal.tsx   # Modal de création de rapport
│   ├── CloseReportModal.tsx    # Modal de clôture de rapport
│   └── AddExpenseDrawer.tsx    # Drawer d'ajout d'opération
└── hooks/                       # Hooks personnalisés
    ├── useReportData.ts        # Gestion des données de rapport
    └── useReportActions.ts     # Gestion des actions (CRUD)
```

## 🧩 Composants

### ReportDashboard.tsx (Principal)
- **Rôle** : Orchestrer l'affichage et coordonner les composants
- **Lignes** : ~230 (vs 696 avant)
- **Responsabilités** :
  - Gérer l'état local du drawer d'ajout d'opération
  - Coordonner les hooks et composants
  - Afficher la structure de la page

### ReportSummaryCards.tsx
- **Rôle** : Afficher les 6 cartes de résumé financier
- **Props** :
  - `reportData` : Données du rapport
  - `isSmall` : Indicateur de petit écran
- **Cartes affichées** :
  - Solde initial
  - Revenus
  - Dépenses
  - Solde banque
  - Opérations à venir
  - Solde final

### ReportSelector.tsx
- **Rôle** : Sélectionner un rapport (en cours ou archivé)
- **Props** :
  - `selectedReportId` : ID du rapport sélectionné
  - `history` : Historique des rapports
  - `onReportChange` : Callback de changement

### CreateReportModal.tsx
- **Rôle** : Modal pour créer un nouveau rapport
- **Props** :
  - `open` : État d'ouverture
  - `onClose` : Callback de fermeture
  - `onGenerate` : Callback de génération
  - `params` : Paramètres du rapport
  - `onParamsChange` : Callback de modification des paramètres

### CloseReportModal.tsx
- **Rôle** : Modal pour clôturer un rapport
- **Props** :
  - `open` : État d'ouverture
  - `onClose` : Callback de fermeture
  - `onConfirm` : Callback de confirmation
  - `closingDate` : Date de clôture
  - `onDateChange` : Callback de modification de la date

### AddExpenseDrawer.tsx
- **Rôle** : Drawer pour ajouter une opération
- **Props** :
  - `open` : État d'ouverture
  - `onClose` : Callback de fermeture
  - `selectedAccountId` : ID du compte sélectionné
  - `onSuccess` : Callback de succès

## 🪝 Hooks personnalisés

### useReportData.ts
- **Rôle** : Gérer toutes les données de rapport
- **Retourne** :
  - `loading` : État de chargement
  - `reportData` : Données du rapport actuel
  - `history` : Historique des rapports
  - `selectedReportId` : ID du rapport sélectionné
  - `fetchAndCalculateReport()` : Calculer un rapport
  - `loadCurrentReport()` : Charger le rapport en cours
  - `refreshCurrentReport()` : Rafraîchir le rapport
  - `fetchHistory()` : Récupérer l'historique

### useReportActions.ts
- **Rôle** : Gérer les actions CRUD sur les rapports
- **Retourne** :
  - États et setters pour les modals
  - `handleGenerateReport()` : Créer un rapport
  - `handleOpenCloseModal()` : Ouvrir le modal de clôture
  - `handleConfirmCloseReport()` : Confirmer la clôture
  - `handleDeleteReport()` : Supprimer un rapport

## ✨ Avantages de la refactorisation

1. **Séparation des responsabilités** : Chaque composant a un rôle clair
2. **Réutilisabilité** : Les composants peuvent être réutilisés ailleurs
3. **Testabilité** : Plus facile de tester des petits composants
4. **Maintenabilité** : Plus facile de trouver et modifier du code
5. **Lisibilité** : Code plus clair et mieux organisé
6. **Performance** : Possibilité d'optimiser chaque composant individuellement

## 🔄 Flux de données

```
ReportDashboard
    ├─> useReportData (hook)
    │   ├─> Fetch data from Supabase
    │   ├─> Calculate report metrics
    │   └─> Manage report state
    │
    ├─> useReportActions (hook)
    │   ├─> Handle create/close/delete
    │   └─> Manage modal states
    │
    └─> Components
        ├─> ReportSelector
        ├─> ReportSummaryCards
        ├─> CreateReportModal
        ├─> CloseReportModal
        └─> AddExpenseDrawer
```

## 🚀 Utilisation

Le composant principal `ReportDashboard` s'utilise exactement de la même manière qu'avant :

```tsx
import { ReportDashboard } from './resources/reports';

// Dans votre App
<Route path="/reports" element={<ReportDashboard />} />
```

Tous les changements sont internes et n'affectent pas l'API publique du composant.
