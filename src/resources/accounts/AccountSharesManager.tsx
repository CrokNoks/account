import { useEffect, useState } from 'react';
import { useDataProvider, useNotify, useRecordContext, useRefresh } from 'react-admin';
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
      notify('Erreur lors du chargement des partages', { type: 'warning' });
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
      notify('Veuillez choisir un utilisateur', { type: 'warning' });
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
      notify('Accès ajouté', { type: 'success' });
      loadShares();
      refresh();
    } catch (error: any) {
      console.error(error);
      notify(error?.message || 'Erreur lors de l’ajout du partage', { type: 'warning' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dataProvider.delete('account_shares', { id });
      notify('Accès retiré', { type: 'info' });
      loadShares();
      refresh();
    } catch (error: any) {
      console.error(error);
      notify(error?.message || 'Erreur lors de la suppression du partage', { type: 'warning' });
    }
  };

  if (!record) return null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Partages du compte
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Ajoute un autre utilisateur via son <code>user_id</code> Supabase et choisis le niveau d’accès.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start" mb={2}>
          <ReferenceInput
            label="Utilisateur"
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
            label="Permission"
            value={formState.permission}
            onChange={(e) =>
              setFormState((s) => ({ ...s, permission: e.target.value as ShareFormState['permission'] }))
            }
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="read">Lecture</MenuItem>
            <MenuItem value="write">Écriture</MenuItem>
          </TextField>
          <Button variant="contained" onClick={handleAdd} sx={{ whiteSpace: 'nowrap' }}>
            Ajouter
          </Button>
        </Stack>

        <Box sx={{ opacity: loading ? 0.6 : 1 }}>
          {shares.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun partage pour ce compte.
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
                      {share.permission === 'write' ? 'Écriture' : 'Lecture'}
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


