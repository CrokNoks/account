import { useEffect, useState } from 'react';
import { useDataProvider, useNotify, useRecordContext, useRefresh, useTranslate } from 'react-admin';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  MenuItem,
  TextField,
  Stack,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { ReferenceInput, AutocompleteInput } from 'react-admin';

interface ShareFormState {
  user_id?: string;
  permission: 'read' | 'write';
}

export const AccountSharesManager = () => {
  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();

  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState<ShareFormState>({
    user_id: undefined,
    permission: 'write',
  });

  const loadShares = async () => {
    if (!record) return;
    setLoading(true);
    try {
      const { data } = await dataProvider.getList('account_shares', {
        filter: { account_id: record.id },
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'created_at', order: 'ASC' },
      });
      setShares(data);
    } catch (error) {
      notify(translate('resources.accounts.shares.notifications.load_error'), { type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  const handleAdd = async () => {
    if (!record) return;
    if (!formState.user_id) {
      notify(translate('resources.accounts.shares.notifications.choose_user'), { type: 'warning' });
      return;
    }
    try {
      await dataProvider.create('account_shares', {
        data: {
          account_id: record.id,
          user_id: formState.user_id,
          permission: formState.permission,
        },
      });
      setFormState({ user_id: undefined, permission: 'write' });
      notify(translate('resources.accounts.shares.notifications.add_success'), { type: 'success' });
      loadShares();
      refresh();
    } catch (error: any) {
      console.error(error);
      notify(error?.message || translate('resources.accounts.shares.notifications.add_error'), { type: 'warning' });
    }
  };

  const handleDelete = async (id: string) => {
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

  if (!record) return null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {translate('resources.accounts.shares.title')}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          gutterBottom
          dangerouslySetInnerHTML={{ __html: translate('resources.accounts.shares.description') }}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start" mb={2}>
          <ReferenceInput
            label={translate('resources.accounts.shares.user')}
            source="user_id"
            reference="app_users"
            perPage={50}
            sort={{ field: 'email', order: 'ASC' }}
            filterToQuery={(search: string) => ({ email_ilike: `%${search}%` })}
          >
            <AutocompleteInput
              optionText="email"
              optionValue="id"
              onChange={(value) => setFormState((s) => ({ ...s, user_id: value as string }))}
              fullWidth
            />
          </ReferenceInput>

          <TextField
            size="small"
            select
            label={translate('resources.accounts.shares.permission')}
            value={formState.permission}
            onChange={(e) =>
              setFormState((s) => ({ ...s, permission: e.target.value as ShareFormState['permission'] }))
            }
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="read">{translate('resources.accounts.shares.permissions.read')}</MenuItem>
            <MenuItem value="write">{translate('resources.accounts.shares.permissions.write')}</MenuItem>
          </TextField>
          <Button variant="contained" onClick={handleAdd} sx={{ whiteSpace: 'nowrap' }}>
            {translate('resources.accounts.shares.add')}
          </Button>
        </Stack>

        <Box sx={{ opacity: loading ? 0.6 : 1 }}>
          {shares.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {translate('resources.accounts.shares.empty')}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {shares.map((share) => (
                <Box
                  key={share.id}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  px={1}
                  py={0.5}
                  bgcolor="action.hover"
                  borderRadius={1}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {share.user_id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {share.permission === 'write'
                        ? translate('resources.accounts.shares.permissions.write')
                        : translate('resources.accounts.shares.permissions.read')}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Supprimer le partage"
                    onClick={() => handleDelete(share.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};


