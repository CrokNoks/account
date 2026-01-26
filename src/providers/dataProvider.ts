import { supabaseDataProvider } from 'ra-supabase';
import { supabaseClient } from '../supabaseClient';
import { DataProvider } from 'react-admin';
import { nestDataProvider } from './nestDataProvider';

const baseDataProvider = supabaseDataProvider({
  instanceUrl: import.meta.env.VITE_SUPABASE_URL,
  apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  supabaseClient,
});

// Utility functions to reduce code duplication
const applyExpenseFilters = (query: any, filter: any) => {
  Object.keys(filter).forEach(key => {
    const value = filter[key];

    if (value === 'is:null') {
      query.is(key, null);
      return;
    }

    if (value === undefined || value === null) {
      return;
    }
    if (key === 'date_gte') {
      query.gte('date', value);
    } else if (key === 'date_lte') {
      query.lte('date', value);
    } else if (key === 'account_id') {
      query.eq('account_id', value);
    } else if (key === 'amount_gte') {
      query.gte('amount', value);
    } else if (key === 'amount_lte') {
      query.lte('amount', value);
    } else if (key === 'description') {
      query.ilike('description', `%${value}%`);
    } else {
      query.eq(key, value);
    }
  });
  return query;
};

const applyCategoryFilters = (query: any, filter: any) => {
  Object.keys(filter).forEach(key => {
    if (key === 'account_id') {
      query.eq('account_id', filter[key]);
    } else if (key === 'name') {
      query.ilike('name', `%${filter[key]}%`);
    } else if (key === 'id_nin') {
      if (Array.isArray(filter[key]) && filter[key].length > 0) {
        query.filter('id', 'not.in', `(${filter[key].join(',')})`);
      }
    } else {
      query.eq(key, filter[key]);
    }
  });
  return query;
};

const handleTransfers = async (data: any) => {
  const {
    source_account_id,
    source_category_id,
    destination_account_id,
    destination_category_id,
    amount,
    description,
    date,
    notes,
  } = data;

  if (!source_account_id || !destination_account_id || !source_category_id || !destination_category_id || !amount) {
    throw new Error('Champs manquants pour le virement');
  }

  const baseFields = {
    description: description || 'Virement entre comptes',
    date: date || new Date().toISOString(),
    notes: notes || null,
    reconciled: false,
  };

  const amountNumber = Number(amount);
  const absAmount = Math.abs(amountNumber);

  const rows = [
    { ...baseFields, account_id: source_account_id, category_id: source_category_id, amount: -absAmount },
    { ...baseFields, account_id: destination_account_id, category_id: destination_category_id, amount: absAmount },
  ];

  const { data: result, error } = await supabaseClient.from('expenses').insert(rows).select();

  if (error) {
    console.error('Erreur création virement (expenses):', error);
    throw new Error(error.message);
  }

  return {
    data: {
      id: result[0]?.id,
      source_account_id,
      destination_account_id,
      amount: absAmount,
      description: baseFields.description,
      date: baseFields.date,
    },
  };
};

const backendResources = ['periods', 'budget-templates', 'budgets'];

export const dataProvider: DataProvider = {
  getList: (resource, params) => {
    if (backendResources.includes(resource)) {
      return nestDataProvider.getList(resource, params);
    }
    return supabaseDataProviderInstance.getList(resource, params);
  },
  getOne: (resource, params) => {
    if (backendResources.includes(resource)) {
      return nestDataProvider.getOne(resource, params);
    }
    return supabaseDataProviderInstance.getOne(resource, params);
  },
  getMany: (resource, params) => {
    if (backendResources.includes(resource)) {
      return nestDataProvider.getMany(resource, params);
    }
    return supabaseDataProviderInstance.getMany(resource, params);
  },
  getManyReference: (resource, params) => {
    if (backendResources.includes(resource)) {
      return nestDataProvider.getManyReference(resource, params);
    }
    return supabaseDataProviderInstance.getManyReference(resource, params);
  },
  update: (resource, params) => {
    if (backendResources.includes(resource)) {
      return nestDataProvider.update(resource, params);
    }
    return supabaseDataProviderInstance.update(resource, params);
  },
  updateMany: (resource, params) => {
    if (backendResources.includes(resource)) {
      // Not fully implemented in backend yet, but route strictly
      return nestDataProvider.updateMany(resource, params);
    }
    return supabaseDataProviderInstance.updateMany(resource, params);
  },
  create: (resource, params) => {
    if (backendResources.includes(resource)) {
      return nestDataProvider.create(resource, params);
    }
    return supabaseDataProviderInstance.create(resource, params);
  },
  delete: (resource, params) => {
    if (backendResources.includes(resource)) {
      return nestDataProvider.delete(resource, params);
    }
    return supabaseDataProviderInstance.delete(resource, params);
  },
  deleteMany: (resource, params) => {
    if (backendResources.includes(resource)) {
      return nestDataProvider.deleteMany(resource, params);
    }
    return supabaseDataProviderInstance.deleteMany(resource, params);
  },
};

const supabaseDataProviderInstance: DataProvider = {
  ...baseDataProvider,
  getList: async (resource, params) => {
    if (resource === 'transfers') {
      // Les virements sont une vue logique : on ne stocke pas de table dédiée
      return {
        data: [],
        total: 0,
      };
    }

    // For expenses, handle date and amount range filters manually
    if (resource === 'expenses') {
      const { pagination = { page: 1, perPage: 10 }, sort = { field: 'date', order: 'DESC' }, filter } = params;
      const { page, perPage } = pagination;
      const { field, order } = sort;

      let query = supabaseClient.from(resource).select('*', { count: 'exact' });
      
      // Apply filters using utility function
      query = applyExpenseFilters(query, filter);

      // Apply sorting and pagination
      query = query.order(field, { ascending: order === 'ASC' })
                   .range((page - 1) * perPage, (page - 1) * perPage + perPage - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return {
        data: data || [],
        total: count || 0,
      };
    }

    // For categories, add explicit account_id scoping to avoid ambiguity and ensure RLS-friendly filters
    if (resource === 'categories') {
      const { pagination = { page: 1, perPage: 10 }, sort = { field: 'name', order: 'ASC' }, filter } = params;
      const { page, perPage } = pagination;
      const { field, order } = sort;

      let query = supabaseClient.from(resource).select('*', { count: 'exact' });
      
      // Apply filters using utility function
      query = applyCategoryFilters(query, filter);

      // Apply sorting and pagination
      query = query.order(field, { ascending: order === 'ASC' })
                   .range((page - 1) * perPage, (page - 1) * perPage + perPage - 1);

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
    if (resource === 'transfers') {
      return await handleTransfers(params.data);
    }

    // Pour les ressources liées à un compte
    if (resource === 'categories' || resource === 'expenses' || resource === 'accounts') {
      const { data: { user } } = await supabaseClient.auth.getUser();

      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const dataToInsert = {
        ...params.data,
      };

      if (resource === 'accounts') {
        dataToInsert.owner_id = user.id;
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