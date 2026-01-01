import { useState, useEffect } from 'react';
import { Create, SimpleForm, DateInput, ArrayInput, SimpleFormIterator, ReferenceInput, SelectInput, NumberInput, useNotify, Button, useRedirect, useDataProvider, Toolbar, SaveButton } from 'react-admin';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { Box, Typography, CircularProgress, TextField } from '@mui/material';
import { useAccount } from '../../context/AccountContext';
import { supabaseClient } from '../../supabaseClient';

const PeriodCreateToolbar = (props: any) => (
  <Toolbar {...props}>
    <SaveButton alwaysEnable />
  </Toolbar>
);

export const PeriodCreate = () => {
  const { selectedAccountId } = useAccount();
  const dataProvider = useDataProvider();
  const notify = useNotify();

  // State
  const [hasHistory, setHasHistory] = useState<boolean | null>(null);
  const [initialDates, setInitialDates] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_NEST_API_URL || 'http://127.0.0.1:5001/account/us-central1/api';

  // Check for history on mount
  useEffect(() => {
    if (!selectedAccountId) return;
    dataProvider.getList('periods', {
      pagination: { page: 1, perPage: 1 },
      sort: { field: 'start_date', order: 'DESC' },
      filter: { accountId: selectedAccountId }
    })
      .then(({ total }) => setHasHistory((total ?? 0) > 0))
      .catch(() => setHasHistory(false));
  }, [selectedAccountId, dataProvider]);

  const fetchPreview = async () => {
    if (!selectedAccountId) return;

    // If no history and missing dates, block
    if (hasHistory === false && (!initialDates.start || !initialDates.end)) {
      notify('Veuillez renseigner les dates pour la première période', { type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const body: any = { account_id: selectedAccountId };
      // If manual dates provided (first run), pass them (backend needs update to support this?)
      // Currently backend preview logic is: if no history, start=today. 
      // We can override clientside after fetch, or pass params if we update backend.
      // Let's rely on client-side override for now to minimize backend churn unless needed.

      // Get token from Supabase directly similarly to dataProvider
      // We assume user is logged in
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(`${apiUrl}/periods/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(body),
      });

      // Wait, we need the token for the preview endpoint too! 
      // Accessing supabase client directly to get session?
      // Or use dataProvider.create? But this is a custom endpoint...
      // Let's rely on the user having a session, but typically we need to pass it.
      // Since I don't have easy access to token here without supabaseClient, 
      // I'll skip adding it for now and assume the user might have RLS issues with preview if I don't fixing it.
      // BUT I AM FIXING "account_id" issue first.

      if (!response.ok) throw new Error('Failed to fetch preview');
      const data = await response.json();

      let finalData = { ...data, account_id: selectedAccountId };

      // Override with manual dates if provided
      if (hasHistory === false && initialDates.start && initialDates.end) {
        finalData.start_date = initialDates.start;
        finalData.end_date = initialDates.end;
        // We might want to re-run AI for budgets based on these dates? 
        // For now, assume budget templates don't depend strictly on exact date duration for the base amount.
      }

      setPreviewData(finalData);
    } catch (error) {
      notify('Erreur lors de la génération de la prévisualisation', { type: 'error' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedAccountId || hasHistory === null) return <CircularProgress />;

  // 1. Initial State: Ask for AI generation (or Dates if 1st time)
  if (!previewData) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <Typography variant="h5">Nouvelle Période</Typography>

        {hasHistory === false ? (
          <Box sx={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Bienvenue ! C'est votre première période. Veuillez définir ses bornes.
            </Typography>
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField
                type="date"
                label="Date de début"
                InputLabelProps={{ shrink: true }}
                value={initialDates.start}
                onChange={e => setInitialDates({ ...initialDates, start: e.target.value })}
              />
              <TextField
                type="date"
                label="Date de fin"
                InputLabelProps={{ shrink: true }}
                value={initialDates.end}
                onChange={e => setInitialDates({ ...initialDates, end: e.target.value })}
              />
            </Box>
          </Box>
        ) : (
          <Typography variant="body1">Laissez l'IA préparer votre prochaine période.</Typography>
        )}

        <Button
          label={hasHistory === false ? "Valider et Générer le Budget" : "Générer avec l'IA"}
          onClick={fetchPreview}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <AutoFixHighIcon />}
          variant="contained"
          size="large"
        />
      </Box>
    );
  }

  // 2. Preview/Edit State: React Admin Form
  return (
    <Create title="Nouvelle Période">
      <SimpleForm defaultValues={previewData} toolbar={<PeriodCreateToolbar />}>
        <Typography variant="h6" sx={{ mb: 2 }}>Configuration de la Période</Typography>

        <Box display="flex" gap={2}>
          <DateInput source="start_date" label="Date de début" validate={(v) => v ? undefined : 'Requis'} />
          <DateInput source="end_date" label="Date de fin" validate={(v) => v ? undefined : 'Requis'} />
        </Box>

        <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Suggestions de Budget</Typography>

        <ArrayInput source="budgets" label="Budgets alloués">
          <SimpleFormIterator inline>
            <ReferenceInput source="category_id" reference="categories" filter={{ account_id: selectedAccountId }}>
              <SelectInput optionText="name" label="Catégorie" />
            </ReferenceInput>
            <NumberInput source="amount_allocated" label="Montant" />
          </SimpleFormIterator>
        </ArrayInput>

      </SimpleForm>
    </Create>
  );
};
