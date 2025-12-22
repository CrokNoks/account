import { useDataProvider, useNotify } from 'react-admin';

export const useTransferActions = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();

  const createTransfer = async (data: any, onSuccess?: () => void) => {
    try {
      // Create expense on source account
      await dataProvider.create('expenses', {
        data: {
          description: data.description,
          amount: -Math.abs(data.amount), // Negative amount for expense
          date: data.date,
          account_id: data.source_account_id,
          category_id: data.source_category_id || null,
          notes: data.notes || '',
          reconciled: false,
        },
      });

      // Create revenue on target account
      await dataProvider.create('expenses', {
        data: {
          description: data.description,
          amount: Math.abs(data.amount), // Positive amount for revenue
          date: data.date,
          account_id: data.destination_account_id,
          category_id: data.destination_category_id || null,
          notes: data.notes || '',
          reconciled: false,
        },
      });

      notify('app.messages.transfer_success', { type: 'success' });
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error creating transfer:', error);
      notify('app.messages.transfer_error', { type: 'error' });
    }
  };

  return {
    createTransfer
  };
};
