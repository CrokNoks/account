import { AuthProvider } from 'react-admin';
import { supabaseClient } from '../supabaseClient';

export const authProvider: AuthProvider = {
  login: async ({ username, password }) => {
    console.log('Tentative de connexion pour:', username);

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: username,
      password,
    });

    if (error) {
      console.error('Erreur Supabase:', error);
      throw new Error(error.message);
    }

    console.log('Connexion réussie:', data);
    return Promise.resolve();
  },

  logout: async () => {
    await supabaseClient.auth.signOut();
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
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
      console.log('Pas de session active, redirection vers login');
      return Promise.reject({ message: 'Session expirée', redirectTo: '/login' });
    }

    return Promise.resolve();
  },

  getPermissions: () => Promise.resolve(),

  getIdentity: async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return Promise.reject();
    }

    return Promise.resolve({
      id: user.id,
      fullName: user.email,
    });
  },
};
