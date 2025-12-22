import { Dialog, DialogTitle, DialogContent, Typography, Box, Button, DialogActions, CircularProgress, Autocomplete, TextField } from '@mui/material';
import { useGetList, useUpdate, useNotify } from 'react-admin';
import { useAccount } from '../../context/AccountContext';
import { useState, useEffect } from 'react';
import { categoryClassifier } from '../../services/CategoryClassifier';

interface CategorizationModalProps {
  open: boolean;
  onClose: () => void;
}

export const CategorizationModal = ({ open, onClose }: CategorizationModalProps) => {
  const { selectedAccountId } = useAccount();
  const notify = useNotify();
  /* const refresh = useRefresh(); */

  // We fetch a larger batch so we can iterate locally
  const { data: expenses, total, isLoading, refetch } = useGetList('expenses', {
    filter: {
      account_id: selectedAccountId,
      category_id: 'is:null'
    },
    pagination: { page: 1, perPage: 20 },
    sort: { field: 'date', order: 'DESC' }
  });

  const { data: categories } = useGetList('categories', {
    pagination: { page: 1, perPage: 100 },
    sort: { field: 'name', order: 'ASC' },
    filter: { account_id: selectedAccountId }
  });

  const [update] = useUpdate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentExpense, setCurrentExpense] = useState<any>(null);
  const [predictedCategoryId, setPredictedCategoryId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [categorizedCount, setCategorizedCount] = useState(0);
  const [initialTotal, setInitialTotal] = useState<number | null>(null);

  // Initialize model on mount and reset state
  useEffect(() => {
    if (open && selectedAccountId) {
      setIsClassifying(true);
      setCurrentIndex(0); // Reset index
      refetch(); // Refresh data from backend
      categoryClassifier.init(selectedAccountId).then(() => {
        setModelReady(true);
        setIsClassifying(false);
      });
      // Reset stats
      setCategorizedCount(0);
      setInitialTotal(null); // Reset total so it can be recaptured
    }
  }, [open, selectedAccountId]);

  // Initialize total count once
  useEffect(() => {
    if (total !== undefined && initialTotal === null) {
      setInitialTotal(total);
    }
  }, [total, initialTotal]);

  const processSave = (expense: any, categoryId: string) => {
    setIsSaving(true);
    update(
      'expenses',
      { id: expense.id, data: { category_id: categoryId }, previousData: expense },
      {
        onSuccess: async () => {
          notify('Catégorie enregistrée', { type: 'success' });
          setCategorizedCount(c => c + 1);

          // Retrain with new example
          if (selectedAccountId) {
            setIsClassifying(true);
            await categoryClassifier.init(selectedAccountId, true);
            setIsClassifying(false); // Model ready for next prediction
          }

          // Move next
          setSelectedCategory('');
          setPredictedCategoryId(null);
          setCurrentIndex(prev => prev + 1);
          setIsSaving(false);
        },
        onError: () => {
          notify('Erreur lors de la sauvegarde', { type: 'error' });
          setIsSaving(false);
        }
      }
    );
  };

  // Set current expense when data is ready
  useEffect(() => {
    if (expenses && expenses.length > 0 && currentIndex < expenses.length) {
      const expense = expenses[currentIndex];
      setCurrentExpense(expense);

      if (modelReady) {
        setIsClassifying(true);
        categoryClassifier.predict({
          description: expense.description,
          amount: expense.amount,
          notes: expense.notes,
          metadata: expense.metadata
        }).then(pred => {
          if (pred) {
            setPredictedCategoryId(pred.id);
            setSelectedCategory(pred.id);

            // Auto-save if high confidence
            if (pred.score >= 0.9) {
              processSave(expense, pred.id);
            }
          } else {
            setPredictedCategoryId(null);
            setSelectedCategory('');
          }
          setIsClassifying(false);
        });
      }
    } else if (expenses && expenses.length > 0 && currentIndex >= expenses.length) {
      // Batch finished, refetch?
      refetch();
      setCurrentIndex(0);
    } else {
      setCurrentExpense(null);
    }
  }, [expenses, currentIndex, modelReady]);

  const handleSave = () => {
    if (!currentExpense || !selectedCategory) return;
    processSave(currentExpense, selectedCategory);
  };

  const handleSkip = () => {
    setSelectedCategory('');
    setPredictedCategoryId(null);
    setCurrentIndex(prev => prev + 1);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Catégorisation assistée</DialogTitle>
      <DialogContent>
        {isLoading || !modelReady ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
            <Typography ml={2}>Chargement du modèle et des données...</Typography>
          </Box>
        ) : !currentExpense ? (
          <Box p={3} textAlign="center">
            <Typography>Toutes les dépenses ont été traitées !</Typography>
            <Button onClick={onClose} sx={{ mt: 2 }}>Fermer</Button>
          </Box>
        ) : (
          <Box>
            <Box mb={2} p={2} bgcolor="#f5f5f5" borderRadius={1}>
              <Typography variant="caption" color="textSecondary">
                {new Date(currentExpense.date).toLocaleDateString()} -{' '}
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(currentExpense.amount)}
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {currentExpense.description}
              </Typography>
              {currentExpense.notes && <Typography variant="body2">{currentExpense.notes}</Typography>}
              {currentExpense.metadata && Object.keys(currentExpense.metadata).length > 0 && (
                <Box mt={1} pt={1} borderTop="1px solid #ddd">
                  <Typography variant="caption" color="textSecondary" display="block" gutterBottom>Données brutes :</Typography>
                  {Object.entries(currentExpense.metadata).map(([key, value]) => (
                    <Typography key={key} variant="caption" display="block" color="textSecondary" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      <strong>{key}:</strong> {String(value)}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>

            <Box mt={2}>
              <Autocomplete
                options={categories || []}
                getOptionLabel={(option: any) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderOption={(props, option) => (
                  <li {...props}>
                    {option.id === predictedCategoryId ? `✨ ${option.name}` : option.name}
                  </li>
                )}
                value={categories?.find((c: any) => c.id === selectedCategory) || null}
                onChange={(_, newValue: any) => setSelectedCategory(newValue ? newValue.id : '')}
                renderInput={(params) => <TextField {...params} label="Catégorie" variant="outlined" />}
                fullWidth
              />
            </Box>

            <Box mt={1} display="flex" justifyContent="space-between">
              <Typography variant="caption" color="textSecondary">
                {initialTotal !== null ? `${categorizedCount} / ${initialTotal} traité(s)` : ''}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {initialTotal ? `${initialTotal - categorizedCount} restant(s)` : ''}
              </Typography>
            </Box>

            {isClassifying && <Typography variant="caption">Analyse en cours...</Typography>}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
        <Button onClick={handleSkip} color="warning" disabled={isSaving}>Passer</Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={!selectedCategory || isClassifying || isSaving}
        >
          {isSaving ? <CircularProgress size={24} color="inherit" /> : 'Valider'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
