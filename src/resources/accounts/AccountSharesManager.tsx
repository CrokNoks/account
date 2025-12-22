import { useEffect, useState } from 'react';
import { useRecordContext, useTranslate } from 'react-admin';
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
import { useAccountShares, ShareFormState } from './hooks/useAccountShares';

export const AccountSharesManager = () => {
  const record = useRecordContext();
  const translate = useTranslate();
  const { shares, loading, loadShares, addShare, removeShare } = useAccountShares(record?.id);

  const [formState, setFormState] = useState<ShareFormState>({
    user_id: undefined,
    permission: 'write',
  });

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const handleAdd = () => {
    addShare(formState, () => {
      setFormState({ user_id: undefined, permission: 'write' });
    });
  };

  const handleDelete = (id: string) => {
    removeShare(id);
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


