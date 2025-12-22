import { useState, useCallback } from 'react';
import { useDataProvider, useNotify, useRefresh, useTranslate, Identifier } from 'react-admin';

export interface ShareFormState {
  user_id?: string;
  permission: 'read' | 'write';
}

export const useAccountShares = (accountId: Identifier | undefined) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();

  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadShares = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const { data } = await dataProvider.getList('account_shares', {
        filter: { account_id: accountId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'created_at', order: 'ASC' },
      });
      setShares(data);
    } catch (error) {
      notify(translate('resources.accounts.shares.notifications.load_error'), { type: 'warning' });
    } finally {
      setLoading(false);
    }
  }, [accountId, dataProvider, notify, translate]);

  const addShare = async (formState: ShareFormState, onSuccess: () => void) => {
    if (!accountId) return;
    if (!formState.user_id) {
      notify(translate('resources.accounts.shares.notifications.choose_user'), { type: 'warning' });
      return;
    }
    try {
      await dataProvider.create('account_shares', {
        data: {
          account_id: accountId,
          user_id: formState.user_id,
          permission: formState.permission,
        },
      });

      notify(translate('resources.accounts.shares.notifications.add_success'), { type: 'success' });
      loadShares();
      refresh();
      onSuccess();
    } catch (error: any) {
      console.error(error);
      notify(error?.message || translate('resources.accounts.shares.notifications.add_error'), { type: 'warning' });
    }
  };

  const removeShare = async (id: string) => {
    try {
      await dataProvider.delete('account_shares', { id });
      notify(translate('resources.accounts.shares.notifications.delete_success'), { type: 'info' });
      loadShares();
      refresh();
    } catch (error: any) {
      console.error(error);
      notify(error?.message || translate('resources.accounts.shares.notifications.delete_error'), { type: 'warning' });
    }
  };

  return {
    shares,
    loading,
    loadShares,
    addShare,
    removeShare
  };
};
