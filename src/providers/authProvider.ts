import { AuthProvider } from 'react-admin';
import { supabaseClient } from '../supabaseClient';

const apiUrl = import.meta.env.VITE_NEST_API_URL || 'http://127.0.0.1:5001/account/us-central1/api';

/**
 * Auth Provider hybride : Firebase Auth + API NestJS pour validation
 * Conserve Supabase pour l'authentification utilisateur mais communique avec NestJS
 */
export const authProvider: AuthProvider = {
  login: async ({ username, password }) => {
    console.log('Tentative de connexion pour:', username);

    // 1. Authentification via Supabase (conservé)
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: username,
      password,
    });

    if (error) {
      console.error('Erreur Supabase:', error);
      throw new Error(error.message);
    }

    console.log('Connexion Supabase réussie:', data);

    // 2. Validation avec API NestJS (optionnel, pour vérifier la compatibilité)
    if (data.session?.access_token) {
      try {
        const response = await fetch(`${apiUrl}/auth/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ token: data.session.access_token }),
        });

        if (!response.ok) {
          console.warn('Warning: API NestJS validation failed, but Supabase auth succeeded');
        } else {
          console.log('API NestJS validation succeeded');
        }
      } catch (apiError) {
        console.warn('API NestJS non joignable, utilisation de Supabase uniquement:', apiError);
        // Ne pas bloquer la connexion si l'API NestJS n'est pas disponible
      }
    }

    return Promise.resolve();
  },

  logout: async () => {
    await supabaseClient.auth.signOut();
    
    // Nettoyer les tokens NestJS si nécessaire
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.warn('API NestJS logout failed:', error);
    }
    
    return Promise.resolve();
  },

  checkError: async (error) => {
    console.log('Vérification erreur:', error);
    if (error.status === 401 || error.status === 403) {
      return Promise.reject();
    }
    return Promise.resolve();
  },

  checkAuth: async () => {
    // 1. Vérifier session Supabase
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
      console.log('Pas de session Supabase active, redirection vers login');
      return Promise.reject({ message: 'Session expirée', redirectTo: '/login' });
    }

    // 2. Valider avec API NestJS (si disponible)
    if (data.session?.access_token) {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`,
          },
        });

        if (!response.ok) {
          console.warn('API NestJS validation failed, but Supabase session is valid');
        }
      } catch (error) {
        console.warn('API NestJS non disponible pour validation:', error);
        // Continuer avec la session Supabase valide
      }
    }

    return Promise.resolve();
  },

  getPermissions: async () => {
    try {
      const { data } = await supabaseClient.auth.getSession();
      
      if (!data.session?.access_token) {
        return Promise.resolve({});
      }

      // Essayer d'obtenir les permissions depuis NestJS
      const response = await fetch(`${apiUrl}/auth/permissions`, {
        headers: {
          'Authorization': `Bearer ${data.session.access_token}`,
        },
      });

      if (response.ok) {
        const permissions = await response.json();
        return Promise.resolve(permissions);
      }
    } catch (error) {
      console.warn('Failed to get permissions from NestJS:', error);
    }

    // Fallback: permissions basiques
    return Promise.resolve({});
  },

  getIdentity: async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return Promise.reject();
    }

    // Essayer d'obtenir le profil complet depuis NestJS
    try {
      const { data } = await supabaseClient.auth.getSession();
      
      if (data.session?.access_token) {
        const response = await fetch(`${apiUrl}/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`,
          },
        });

        if (response.ok) {
          const profile = await response.json();
          return Promise.resolve({
            id: user.id,
            fullName: profile.fullName || user.email,
            avatar: profile.avatar,
            email: user.email,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to get profile from NestJS:', error);
    }

    // Fallback: utiliser les données Supabase
    return Promise.resolve({
      id: user.id,
      fullName: user.email,
      email: user.email,
    });
  },
};
