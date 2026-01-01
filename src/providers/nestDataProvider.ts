import { fetchUtils, DataProvider } from 'react-admin';
import { stringify } from 'query-string';
import { supabaseClient } from '../supabaseClient';

const apiUrl = import.meta.env.VITE_NEST_API_URL || 'http://127.0.0.1:5001/account/us-central1/api';

const httpClient = async (url: string, options: any = {}) => {
  if (!options.headers) {
    options.headers = new Headers({ Accept: 'application/json' });
  } else if (!(options.headers instanceof Headers)) {
    options.headers = new Headers(options.headers);
  }

  const { data } = await supabaseClient.auth.getSession();
  if (data.session?.access_token) {
    options.headers.set('Authorization', `Bearer ${data.session.access_token}`);
  }

  return fetchUtils.fetchJson(url, options);
};

export const nestDataProvider: DataProvider = {
  getList: (resource, params) => {
    const { page, perPage } = params.pagination || { page: 1, perPage: 10 };
    const { field, order } = params.sort || { field: 'id', order: 'ASC' };

    const query = {
      sort: JSON.stringify([field, order]),
      range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
      filter: JSON.stringify(params.filter),
      ...params.filter
    };
    const url = `${apiUrl}/${resource}?${stringify(query)}`;

    return httpClient(url).then(({ json }) => ({
      data: json,
      total: json.length, // TODO: Implement real pagination in backend
    }));
  },

  getOne: (resource, params) =>
    httpClient(`${apiUrl}/${resource}/${params.id}`).then(({ json }) => ({
      data: json,
    })),

  getMany: (resource, params) => {
    return Promise.all(
      params.ids.map(id => httpClient(`${apiUrl}/${resource}/${id}`))
    ).then(responses => ({
      data: responses.map(({ json }) => json),
    }));
  },

  getManyReference: (resource, params) => {
    const { page, perPage } = params.pagination || { page: 1, perPage: 10 };
    const { field, order } = params.sort || { field: 'id', order: 'ASC' };

    const query = {
      sort: JSON.stringify([field, order]),
      range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
      filter: JSON.stringify({
        ...params.filter,
        [params.target]: params.id,
      }),
      [params.target]: params.id,
    };
    const url = `${apiUrl}/${resource}?${stringify(query)}`;

    return httpClient(url).then(({ json }) => ({
      data: json,
      total: json.length,
    }));
  },

  update: (resource, params) =>
    httpClient(`${apiUrl}/${resource}/${params.id}`, {
      method: 'PUT',
      body: JSON.stringify(params.data),
    }).then(({ json }) => ({ data: json })),

  updateMany: (resource, params) => {
    return Promise.all(
      params.ids.map(id =>
        httpClient(`${apiUrl}/${resource}/${id}`, {
          method: 'PUT',
          body: JSON.stringify(params.data),
        })
      )
    ).then(responses => ({
      data: responses.map(({ json }) => json.id),
    }));
  },

  create: (resource, params) => {
    const query = {
      accountId: params.data.account_id,
    };
    return httpClient(`${apiUrl}/${resource}?${stringify(query)}`, {
      method: 'POST',
      body: JSON.stringify(params.data),
    }).then(({ json }) => ({
      data: { ...params.data, id: json.id } as any,
    }))
  },

  delete: (resource, params) =>
    httpClient(`${apiUrl}/${resource}/${params.id}`, {
      method: 'DELETE',
    }).then(({ json }) => ({ data: json })),

  deleteMany: (resource, params) => {
    return Promise.all(
      params.ids.map(id =>
        httpClient(`${apiUrl}/${resource}/${id}`, {
          method: 'DELETE',
        })
      )
    ).then(responses => ({
      data: responses.map(({ json }) => json.id),
    }));
  },
};
