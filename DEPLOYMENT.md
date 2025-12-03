# Déploiement Firebase

## Configuration initiale

1. **Connectez-vous à Firebase CLI** (si ce n'est pas déjà fait) :
   ```bash
   firebase login
   ```

2. **Créez un projet Firebase** sur [console.firebase.google.com](https://console.firebase.google.com)

3. **Liez votre projet local au projet Firebase** :
   ```bash
   firebase use --add
   ```
   Sélectionnez votre projet et donnez-lui un alias (par exemple : `production`)

## Déploiement manuel

### 1. Build de l'application
```bash
npm run build
```

### 2. Déploiement sur Firebase Hosting
```bash
firebase deploy --only hosting
```

## Déploiement automatique (CI/CD avec GitHub Actions)

### Configuration des secrets GitHub

Pour activer le déploiement automatique, vous devez configurer les secrets suivants dans votre repository GitHub :

1. **Allez dans votre repository GitHub** → Settings → Secrets and variables → Actions

2. **Ajoutez les secrets suivants** :

   - **`VITE_SUPABASE_URL`** : L'URL de votre projet Supabase
   - **`VITE_SUPABASE_ANON_KEY`** : La clé anonyme de votre projet Supabase
   - **`FIREBASE_PROJECT_ID`** : L'ID de votre projet Firebase
   - **`FIREBASE_SERVICE_ACCOUNT`** : Le compte de service Firebase (voir ci-dessous)

### Générer le compte de service Firebase

```bash
# Générer le token de service account
firebase login:ci
```

Copiez le token généré et ajoutez-le comme secret `FIREBASE_SERVICE_ACCOUNT` dans GitHub.

**Alternative (recommandée)** : Utilisez un service account JSON :

1. Allez dans [Firebase Console](https://console.firebase.google.com)
2. Project Settings → Service Accounts
3. Generate New Private Key
4. Copiez tout le contenu du fichier JSON
5. Ajoutez-le comme secret `FIREBASE_SERVICE_ACCOUNT` dans GitHub

### Workflow

Une fois configuré, le déploiement se fera automatiquement :
- À chaque push sur la branche `main`
- Manuellement via l'onglet "Actions" de GitHub

Le workflow :
1. Installe les dépendances
2. Build l'application avec les variables d'environnement
3. Déploie sur Firebase Hosting

## Configuration

Le fichier `firebase.json` est déjà configuré avec :
- **Public directory** : `dist` (dossier de build Vite)
- **Rewrites** : Toutes les routes redirigent vers `index.html` (pour le routing React)
- **Cache** : Headers de cache optimisés pour les assets statiques

## Variables d'environnement

N'oubliez pas de configurer vos variables d'environnement Supabase dans votre fichier `.env` :
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Ces variables seront intégrées au build lors de `npm run build`.

## Commandes utiles

- **Tester localement** : `firebase serve`
- **Voir les logs** : `firebase hosting:channel:list`
- **Déployer sur un canal de preview** : `firebase hosting:channel:deploy preview`

## Vérification du déploiement

Après un déploiement réussi, votre application sera accessible à :
- **URL de production** : `https://[FIREBASE_PROJECT_ID].web.app`
- **URL alternative** : `https://[FIREBASE_PROJECT_ID].firebaseapp.com`

