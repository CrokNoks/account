# 💰 Mes Comptes - Gestionnaire de Finances Personnelles

Une application moderne, rapide et mobile-first pour suivre vos dépenses et revenus, construite avec **React Admin** et **Supabase**.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=flat&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg?style=flat&logo=supabase&logoColor=white)
![Material UI](https://img.shields.io/badge/Material--UI-5.15-007FFF.svg?style=flat&logo=mui&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-purple.svg?style=flat&logo=pwa&logoColor=white)

## ✨ Fonctionnalités

- **📱 Mobile First & PWA** : Interface optimisée pour mobile, installable comme une application native.
- **📊 Rapports Mensuels** : Génération automatique de rapports avec suivi des soldes (initial, final, pointé).
- **📈 Visualisation** : Graphiques d'évolution des dépenses et revenus par catégorie.
- **🌗 Mode Sombre** : Support complet du thème clair et sombre.
- **📥 Import CSV** : Import facile de vos relevés bancaires.
- **🏷️ Catégorisation** : Gestion flexible des catégories avec budgets et couleurs.
- **✅ Pointage** : Système de réconciliation bancaire (pointage des opérations).
- **🔒 Sécurisé** : Authentification et Row Level Security (RLS) via Supabase.

## 🚀 Technologies

- **Frontend**: React, TypeScript, React Admin, Material UI, Recharts
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Build**: Vite, Vite PWA

## 🛠️ Installation

### 1. Cloner le projet

```bash
git clone https://github.com/CrokNoks/account.git
cd account
npm install
```

### 2. Configurer Supabase

1. Créez un projet sur [Supabase](https://supabase.com).
2. Exécutez le script SQL fourni dans `supabase/schema.sql` via l'éditeur SQL de Supabase pour créer les tables et les politiques de sécurité.

### 3. Variables d'environnement

Créez un fichier `.env` à la racine du projet en copiant `.env.example` :

```bash
cp .env.example .env
```

Remplissez les variables avec vos identifiants Supabase :

```env
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anon_publique
```

### 4. Lancer l'application

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:5173`.

## 📱 PWA (Progressive Web App)

L'application est configurée comme une PWA. Une fois déployée (ou en local avec HTTPS), vous pouvez l'installer sur votre téléphone via le navigateur ("Ajouter à l'écran d'accueil").

## 🤝 Contribuer

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une Pull Request.

1. Forker le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commiter vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Pusher la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Distribué sous la licence MIT.
