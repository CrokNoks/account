import { DataProvider } from 'react-admin';
import { nestDataProvider } from './nestDataProvider';

/**
 * Data Provider unifié utilisant uniquement l'API NestJS
 * Toutes les ressources (accounts, categories, expenses, etc.) passent par le backend
 * Plus de connexion directe Supabase depuis le frontend
 */
export const dataProvider: DataProvider = {
  getList:    (resource, params) => nestDataProvider.getList(resource, params),
  getOne:     (resource, params) => nestDataProvider.getOne(resource, params),
  getMany:    (resource, params) => nestDataProvider.getMany(resource, params),
  getManyReference: (resource, params) => nestDataProvider.getManyReference(resource, params),
  create:     (resource, params) => nestDataProvider.create(resource, params),
  update:     (resource, params) => nestDataProvider.update(resource, params),
  updateMany: (resource, params) => nestDataProvider.updateMany(resource, params),
  delete:     (resource, params) => nestDataProvider.delete(resource, params),
  deleteMany: (resource, params) => nestDataProvider.deleteMany(resource, params),
};