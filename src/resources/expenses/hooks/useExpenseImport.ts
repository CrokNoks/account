import { useState } from 'react';
import { useNotify, useRefresh, useTranslate } from 'react-admin';
import { supabaseClient } from '../../../supabaseClient';
import { useAccount } from '../../../context/AccountContext';
import { parseExpenseCSV } from '../../../utils/csvParsers';

export const useExpenseImport = () => {
  const { selectedAccountId } = useAccount();
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();
  const [loading, setLoading] = useState(false);

  const importFile = async (file: File) => {
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
        const { expenses, initialBalance } = await parseExpenseCSV(text);

        // Update initial balance if needed
        if (initialBalance !== null) {
          const { data: account } = await supabaseClient
            .from('accounts')
            .select('initial_balance')
            .eq('id', selectedAccountId)
            .single();

          if (account && (account.initial_balance === 0 || account.initial_balance === null)) {
            await supabaseClient
              .from('accounts')
              .update({ initial_balance: initialBalance })
              .eq('id', selectedAccountId);

            notify(translate('resources.accounts.notifications.balance_updated', { balance: initialBalance }), { type: 'info' });
          }
        }

        if (expenses.length === 0) {
          notify(translate('resources.expenses.notifications.no_valid_data'), { type: 'warning' });
          setLoading(false);
          return;
        }

        // Add account_id to expenses
        const expensesWithAccount = expenses.map(exp => ({
          ...exp,
          reconciled: true,
          account_id: selectedAccountId
        }));

        const { error } = await supabaseClient
          .from('expenses')
          .insert(expensesWithAccount);

        if (error) throw error;

        notify(translate('resources.expenses.notifications.import_success', { count: expenses.length }), { type: 'success' });
        refresh();
      } catch (error: any) {
        console.error('Import error:', error);
        notify(translate('resources.expenses.notifications.import_error', { error: error?.message || 'Unknown error' }), { type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  return {
    importFile,
    loading
  };
};
