import { useEffect, useState } from 'react';
import { useDataProvider, useNotify, Loading, useTranslate } from 'react-admin';
import { Select, MenuItem, FormControl, InputLabel, Box } from '@mui/material';
import { useAccount } from '../context/AccountContext';

interface Account {
  id: string;
  name: string;
}

export const AccountSelector = () => {
  const { selectedAccountId, setSelectedAccountId } = useAccount();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const translate = useTranslate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data } = await dataProvider.getList('accounts', {
          pagination: { page: 1, perPage: 100 },
          sort: { field: 'name', order: 'ASC' },
          filter: {},
        });
        setAccounts(data);

        // If no account is selected and we have accounts, select the first one
        if (!selectedAccountId && data.length > 0) {
          setSelectedAccountId(data[0].id);
        }
        // If selected account is not in the list (e.g. deleted), deselect it
        else if (selectedAccountId && !data.find((a: Account) => a.id === selectedAccountId)) {
          if (data.length > 0) {
            setSelectedAccountId(data[0].id);
          } else {
            setSelectedAccountId(null);
          }
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
        notify(translate('resources.accounts.shares.notifications.load_error'), { type: 'warning' });
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [dataProvider, notify, selectedAccountId, setSelectedAccountId]);

  if (loading) return <Loading />;

  if (accounts.length === 0) {
    return (
      <Box sx={{ minWidth: { xs: 120, sm: 200 }, mr: 2, color: 'white' }}>
        {translate('app.components.account_selector.no_account')}
      </Box>
    );
  }

  return (
    <Box sx={{ minWidth: { xs: 120, sm: 200 }, mr: { xs: 1, sm: 2 } }}>
      <FormControl fullWidth size="small">
        <InputLabel id="account-select-label" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          {translate('app.components.account_selector.label')}
        </InputLabel>
        <Select
          labelId="account-select-label"
          id="account-select"
          value={selectedAccountId || ''}
          label={translate('app.components.account_selector.label')}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          sx={{
            color: 'white',
            '.MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.5)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'white',
            },
            '.MuiSvgIcon-root': {
              color: 'white',
            },
          }}
        >
          {accounts.map((account) => (
            <MenuItem key={account.id} value={account.id}>
              {account.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};
