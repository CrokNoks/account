import { useNotify, useUpdate, useRefresh, useTranslate } from 'react-admin';

export const useExpenseActions = () => {
  const notify = useNotify();
  const [update] = useUpdate();
  const refresh = useRefresh();
  const translate = useTranslate();

  const toggleReconciled = async (record: any, onSuccess?: () => void) => {
    const newValue = !record.reconciled;
    try {
      await update(
        'expenses',
        { id: record.id, data: { reconciled: newValue }, previousData: record }
      );
      await refresh();
      notify(translate('app.expenses.notifications.status_updated'), { type: 'success' });
      if (onSuccess) onSuccess();
    } catch (error) {
      notify(translate('app.expenses.notifications.update_error'), { type: 'error' });
    }
  };

  return {
    toggleReconciled
  };
};
