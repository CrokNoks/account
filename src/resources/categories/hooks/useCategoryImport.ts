import { useState } from 'react';
import { useNotify, useRefresh, useTranslate } from 'react-admin';
import { supabaseClient } from '../../../supabaseClient';
import { useAccount } from '../../../context/AccountContext';
import { parseCategoryCSV } from '../../../utils/csvParsers';

export const useCategoryImport = () => {
  const { selectedAccountId } = useAccount();
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();
  const [loading, setLoading] = useState(false);

  const importFile = async (file: File, onSuccess?: () => void) => {
    if (!selectedAccountId) {
      notify(translate('resources.expenses.notifications.no_account'), { type: 'warning' });
      return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setLoading(false);
        return;
      }

      try {
        const categories = await parseCategoryCSV(text);

        if (categories.length === 0) {
          notify(translate('resources.categories.notifications.no_valid_data'), { type: 'warning' });
          setLoading(false);
          return;
        }

        // Add account_id to categories
        const categoriesWithAccount = categories.map(cat => ({
          ...cat,
          account_id: selectedAccountId
        }));

        const { error } = await supabaseClient
          .from('categories')
          .insert(categoriesWithAccount);

        if (error) throw error;

        notify(translate('resources.categories.notifications.import_success', { count: categories.length }), { type: 'success' });
        refresh();
        if (onSuccess) onSuccess();
      } catch (error: any) {
        console.error('Import error:', error);
        notify(translate('resources.categories.notifications.import_error', { error: error?.message || 'Unknown error' }), { type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return {
    importFile,
    loading
  };
};
