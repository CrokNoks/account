# Application de Suivi de Dépenses

Une application moderne de suivi de dépenses construite avec React Admin et Supabase.

## 🚀 Technologies

- **Frontend**: React + TypeScript + React Admin
- **Backend**: Supabase (PostgreSQL + Auth)
- **Integration**: ra-supabase (package officiel pour React Admin ↔ Supabase)
- **Bundler**: Vite

## 📋 Prérequis

- Node.js 18+ et npm
- Un compte Supabase

## 🛠️ Installation

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer Supabase

#### a. Créer un projet Supabase
1. Aller sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet
3. Attendre que le projet soit prêt

#### b. Configurer la base de données
1. Aller dans l'onglet "SQL Editor" de votre projet Supabase
2. Copier le contenu du fichier `supabase/schema.sql`
3. Exécuter le script SQL

#### c. Configurer les variables d'environnement
1. Copier le fichier `.env.example` vers `.env`:
   ```bash
   cp .env.example .env
   ```
2. Remplir les variables dans `.env` avec vos credentials Supabase:
   - `VITE_SUPABASE_URL`: URL de votre projet (Settings > API > Project URL)
   - `VITE_SUPABASE_ANON_KEY`: Clé anonyme (Settings > API > Project API keys > anon public)

### 3. Lancer l'application

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

## 📁 Structure du projet

```
account-v2/
├── src/
│   ├── resources/           # Ressources React Admin
│   │   ├── expenses/        # Gestion des dépenses
│   │   └── categories/      # Gestion des catégories
│   ├── providers/           # Providers pour React Admin
│   │   ├── dataProvider.ts  # Provider de données Supabase
│   │   └── authProvider.ts  # Provider d'authentification
│   ├── supabaseClient.ts    # Client Supabase
│   ├── App.tsx              # Composant principal
│   └── main.tsx             # Point d'entrée
├── supabase/
│   └── schema.sql           # Schéma de base de données
├── .env.example             # Exemple de variables d'environnement
└── package.json
```

## 🔐 Authentification

L'application utilise l'authentification Supabase. Pour créer un utilisateur:

1. Aller dans votre projet Supabase > Authentication > Users
2. Cliquer sur "Add user" ou "Invite user"
3. Utiliser ces credentials pour vous connecter à l'application

## 📊 Ressources disponibles

### Dépenses (Expenses)
- Date
- Description
- Montant
- Catégorie (référence)
- Notes

### Catégories (Categories)
- Nom
- Description
- Couleur

## 🔒 Sécurité

Le projet utilise Row Level Security (RLS) de Supabase pour s'assurer que:
- Les utilisateurs ne peuvent voir que leurs propres données
- Les utilisateurs ne peuvent créer/modifier/supprimer que leurs propres enregistrements

## 🚀 Prochaines étapes

Vous pouvez étendre l'application en ajoutant:
- Dashboard avec statistiques
- Graphiques et visualisations
- Export de données
- Filtres avancés
- Tags pour les dépenses
- Budget mensuel
- Récurrence de dépenses

## 📝 Scripts disponibles

- `npm run dev` - Lancer le serveur de développement
- `npm run build` - Construire pour la production
- `npm run preview` - Prévisualiser la build de production
- `npm run lint` - Linter le code

## 🐛 Débogage

Si vous rencontrez des problèmes:

1. Vérifier que les variables d'environnement sont correctes
2. Vérifier que le schéma SQL a été exécuté sans erreurs
3. Vérifier les logs de la console du navigateur
4. Vérifier les logs Supabase (Logs > Postgres Logs)
