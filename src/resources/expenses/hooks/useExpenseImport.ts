import { useState } from 'react';
import { useNotify, useRefresh, useTranslate } from 'react-admin';
import { supabaseClient } from '../../../supabaseClient';
import { useAccount } from '../../../context/AccountContext';
import { parseExpenseCSV, ExpenseImportData } from '../../../utils/csvParsers';


export const useExpenseImport = () => {
  const { selectedAccountId } = useAccount();
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();
  const [loading, setLoading] = useState(false);


  const saveExpenses = async (expenses: ExpenseImportData[]) => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const expensesWithAccount = expenses.map(exp => ({
        ...exp,
        reconciled: true,
        account_id: selectedAccountId
      }));

      // Remove internal fields
      const payload = expensesWithAccount.map(({ confidence, ...rest }) => rest);

      const { error } = await supabaseClient
        .from('expenses')
        .insert(payload);

      if (error) throw error;

      notify(translate('resources.expenses.notifications.import_success', { count: expenses.length }), { type: 'success' });
      refresh();
    } catch (error: any) {
      console.error('Import error:', error);
      notify(translate('resources.expenses.notifications.import_error', { error: error?.message || 'Unknown error' }), { type: 'error' });
    } finally {
      setLoading(false);
      // We don't need to clear queue as there is none
    }
  };

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

        // Directly save expenses
        await saveExpenses(expenses);

      } catch (error: any) {
        console.error('Import error:', error);
        notify(translate('resources.expenses.notifications.import_error', { error: error?.message || 'Unknown error' }), { type: 'error' });
        setLoading(false);
      }
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  // Keep these stubs to avoid breaking ImportExpensesButton right away if not updated simultaneously?
  // But strictly we should return what's needed.
  // The user said "remove Tensorflow".
  // The ImportButton uses { currentSuspiciousExpense, stats, etc }
  // We need to provide "dummy" values or update ImportButton.
  // I will update ImportButton in next step, but here I return simpler object.
  // Wait, I must provide compatible return or update consumer. 
  // I will provide null for suspicious stuff.

  return {
    importFile,
    loading,
    currentSuspiciousExpense: null,
    handleSuspiciousResolved: async () => { },
    handleCancel: () => { },
    stats: { queueLength: 0, completedCount: 0 }
  };
};
