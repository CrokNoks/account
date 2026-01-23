import { useState, useEffect } from 'react';
import { Create, SimpleForm, DateInput, ArrayInput, SimpleFormIterator, ReferenceInput, SelectInput, NumberInput, useNotify, Button, useDataProvider, Toolbar, SaveButton, useGetList } from 'react-admin';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { Box, Typography, CircularProgress, TextField } from '@mui/material';
import { useAccount } from '../../context/AccountContext';
import { supabaseClient } from '../../supabaseClient';

import RefreshIcon from '@mui/icons-material/Refresh';

const PeriodCreateToolbar = (props: any) => {
  const { onRefresh, loading, ...rest } = props;
  return (
    <Toolbar {...rest}>
      <SaveButton alwaysEnable />
      <Button
        label="Rafrachir l'IA"
        onClick={onRefresh}
        disabled={loading}
        startIcon={<RefreshIcon />}
        sx={{ ml: 2 }}
      />
    </Toolbar>
  );
};

export const PeriodCreate = () => {
  const { selectedAccountId } = useAccount();
  const dataProvider = useDataProvider();
  const notify = useNotify();

  // Get categories for budget pre-filling
  const { data: categories } = useGetList('categories', {
    filter: { account_id: selectedAccountId },
    pagination: { page: 1, perPage: 100 },
    sort: { field: 'name', order: 'ASC' }
  });

  // State
  const [hasHistory, setHasHistory] = useState<boolean | null>(null);
  const [initialDates, setInitialDates] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_NEST_API_URL || 'http://127.0.0.1:5001/account/us-central1/api';

  // Generate default budgets from categories
  const generateDefaultBudgets = () => {
    if (!categories || categories.length === 0) return [];
    
    return categories.map(category => ({
      category_id: category.id,
      amount_allocated: category.budget || 0, // Use existing category budget if available
    }));
  };

  // Check for history on mount
  useEffect(() => {
    if (!selectedAccountId) return;
    dataProvider.getList('periods', {
      pagination: { page: 1, perPage: 1 },
      sort: { field: 'start_date', order: 'DESC' },
      filter: { account_id: selectedAccountId }
    })
      .then(({ total }) => setHasHistory((total ?? 0) > 0))
      .catch(() => setHasHistory(false));
  }, [selectedAccountId, dataProvider]);

  const fetchPreview = async () => {
    if (!selectedAccountId) return;

    // If no history and missing start dates, block (End date is optional)
    if (hasHistory === false && !initialDates.start) {
      notify('Veuillez renseigner la date de début pour la première période', { type: 'warning' });
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

      if (!response.ok) throw new Error('Failed to fetch preview');
      const data = await response.json();

      let finalData = {
        ...data,
        account_id: selectedAccountId,
        start_date: data.startDate, // Map backend camelCase to React Admin snake_case
        end_date: data.endDate,
        // Pre-fill budgets with categories if no AI suggestions
        budgets: data.budgets && data.budgets.length > 0 ? data.budgets : generateDefaultBudgets()
      };

      // Override with manual dates if provided (only if no history, otherwise use AI/Backend dates)
      if (hasHistory === false && initialDates.start && initialDates.end) {
        finalData.start_date = initialDates.start;
        finalData.end_date = initialDates.end;
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

  // Custom save function to handle budgets properly
  const handleSave = async (values: any) => {
    try {
      setLoading(true);
      
      // Get token from Supabase
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        notify('Erreur d\'authentification', { type: 'error' });
        return;
      }

      const response = await fetch(`${apiUrl}/periods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          account_id: selectedAccountId,
          start_date: values.start_date,
          end_date: values.end_date,
          budgets: values.budgets || generateDefaultBudgets()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create period');
      }

      const newPeriod = await response.json();
      notify('Période créée avec succès', { type: 'success' });
      
      // Redirect to the new period
      window.location.href = `/periods/${newPeriod.id}/show`;
      
    } catch (error: any) {
      console.error('Save error:', error);
      notify(`Erreur: ${error.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Preview/Edit State: React Admin Form
  return (
    <Create title="Nouvelle Période">
      <SimpleForm defaultValues={previewData} onSubmit={handleSave} toolbar={<PeriodCreateToolbar onRefresh={fetchPreview} loading={loading} />}>
        <Typography variant="h6" sx={{ mb: 2 }}>Configuration de la Période</Typography>

        <Box display="flex" gap={2}>
          <DateInput source="start_date" label="Date de début" validate={(v) => v ? undefined : 'Requis'} />
          <DateInput source="end_date" label="Date de fin" />
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 2, mb: 1 }}>
          <Typography variant="subtitle1">Budgets par Catégorie</Typography>
          <Button
            label="Ajouter toutes les catégories"
            onClick={() => {
              if (categories && categories.length > 0) {
                // Set the budgets in the form state
                const allBudgets = generateDefaultBudgets();
                setPreviewData((prev: any) => ({ ...prev, budgets: allBudgets }));
                notify(`${categories.length} catégories ajoutées au budget`, { type: 'success' });
              }
            }}
            size="small"
            variant="outlined"
            disabled={!categories || categories.length === 0}
          />
        </Box>

        <ArrayInput source="budgets" label="Budgets alloués">
          <SimpleFormIterator inline>
            <ReferenceInput source="category_id" reference="categories" filter={{ account_id: selectedAccountId }}>
              <SelectInput optionText="name" label="Catégorie" />
            </ReferenceInput>
            <NumberInput source="amount_allocated" label="Montant alloué" helperText="Budget pour cette catégorie" />
          </SimpleFormIterator>
        </ArrayInput>

        {categories && categories.length > 0 && (!previewData?.budgets || previewData.budgets.length === 0) && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
            <Typography variant="body2" color="info.main">
              💡 Astuce : {categories.length} catégories trouvées. 
              Cliquez sur "Ajouter toutes les catégories" pour pré-remplir automatiquement les budgets.
            </Typography>
          </Box>
        )}

        {(!categories || categories.length === 0) && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.lighter', borderRadius: 1 }}>
            <Typography variant="body2" color="warning.main">
              ⚠️ Aucune catégorie trouvée. 
              Créez d'abord des catégories avant de définir des budgets.
            </Typography>
          </Box>
        )}

      </SimpleForm>
    </Create>
  );
};
