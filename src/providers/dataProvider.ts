import { supabaseDataProvider } from 'ra-supabase';
import { supabaseClient } from '../supabaseClient';
import { DataProvider } from 'react-admin';

const baseDataProvider = supabaseDataProvider({
  instanceUrl: import.meta.env.VITE_SUPABASE_URL,
  apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  supabaseClient,
});

export const dataProvider: DataProvider = {
  ...baseDataProvider,
  getList: async (resource, params) => {
    // For expenses, handle date and amount range filters manually
    if (resource === 'expenses') {
      const { pagination = { page: 1, perPage: 10 }, sort = { field: 'date', order: 'DESC' }, filter } = params;
      const { page, perPage } = pagination;
      const { field, order } = sort;

      let query = supabaseClient
        .from(resource)
        .select('*, category:categories(id, name, color)', { count: 'exact' });

      // Apply filters
      Object.keys(filter).forEach(key => {
        if (key === 'date_gte') {
          query = query.gte('date', filter[key]);
        } else if (key === 'date_lte') {
          query = query.lte('date', filter[key]);
        } else if (key === 'amount_gte') {
          query = query.gte('amount', filter[key]);
        } else if (key === 'amount_lte') {
          query = query.lte('amount', filter[key]);
        } else if (key === 'description') {
          query = query.ilike('description', `%${filter[key]}%`);
        } else {
          query = query.eq(key, filter[key]);
        }
      });

      // Apply sorting
      query = query.order(field, { ascending: order === 'ASC' });

      // Apply pagination
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return {
        data: data || [],
        total: count || 0,
      };
    }

    // For other resources, use default behavior
    return baseDataProvider.getList(resource, params);
  },
  create: async (resource, params) => {
    // Pour les ressources liées à un compte, on s'assure d'injecter le user_id (créateur)
    // L'account_id doit déjà être présent dans params.data via le transform du composant
    if (resource === 'categories' || resource === 'expenses' || resource === 'accounts') {
      const { data: { user } } = await supabaseClient.auth.getUser();

      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // On prépare les données
      const dataToInsert = {
        ...params.data,
        // On force le user_id si la table le demande (c'est le cas pour categories/expenses/accounts)
        // Pour accounts, c'est 'owner_id' dans le schéma, mais 'user_id' est souvent utilisé par convention react-admin
        // Mon schéma accounts a 'owner_id'.
        // Mes schémas categories/expenses ont 'user_id'.
      };

      if (resource === 'accounts') {
        dataToInsert.owner_id = user.id;
      } else {
        dataToInsert.user_id = user.id;
      }

      const { data, error } = await supabaseClient
        .from(resource)
        .insert(dataToInsert)
        .select()
        .single();

      if (error) {
        console.error(`Erreur création Supabase (${resource}):`, error);
        throw new Error(error.message);
      }

      return { data };
    }

    return baseDataProvider.create(resource, params);
  },
};
