import { useRef, useState } from 'react';
import { Button } from '@mui/material';
import { useNotify, useRefresh, useTranslate } from 'react-admin';
import UploadIcon from '@mui/icons-material/Upload';
import Papa from 'papaparse';
import { supabaseClient } from '../../supabaseClient';
import { useAccount } from '../../context/AccountContext';

export const ImportCategoriesButton = () => {
  const { selectedAccountId } = useAccount();
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedAccountId) {
      notify(translate('resources.expenses.notifications.no_account'), { type: 'warning' });
      return;
    }

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        try {
          const categories = results.data.map((row: any) => ({
            name: row.name || row.Nom || row.nom,
            description: row.description || row.Description || '',
            color: row.color || row.Couleur || row.couleur || '#000000',
            account_id: selectedAccountId,
          }));

          const validCategories = categories.filter((c: any) => c.name);

          if (validCategories.length === 0) {
            notify(translate('resources.categories.notifications.no_valid_data'), { type: 'warning' });
            setLoading(false);
            return;
          }

          const { error } = await supabaseClient
            .from('categories')
            .insert(validCategories);

          if (error) throw error;

          notify(translate('resources.categories.notifications.import_success', { count: validCategories.length }), { type: 'success' });
          refresh();
        } catch (error: any) {
          console.error('Import error:', error);
          notify(translate('resources.categories.notifications.import_error', { error: error.message }), { type: 'error' });
        } finally {
          setLoading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: (error: any) => {
        console.error('Parse error:', error);
        notify(translate('resources.categories.notifications.import_error', { error: error.message }), { type: 'error' });
        setLoading(false);
      }
    });
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".csv"
        onChange={handleFileChange}
      />
      <Button
        variant="contained"
        onClick={handleClick}
        disabled={loading}
        startIcon={<UploadIcon />}
      >
        {loading ? translate('app.components.import.loading') : translate('app.components.import.button')}
      </Button>
    </>
  );
};
