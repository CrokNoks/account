import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  Typography,
  Box,
  FormControl,
  InputLabel,
  LinearProgress
} from '@mui/material';
import { useTranslate } from 'react-admin';
import { ExpenseImportData } from '../../utils/csvParsers';
import { CONFIG } from '../../config';

interface Props {
  open: boolean;
  expense: ExpenseImportData;
  progress: { current: number; total: number };
  onConfirm: (correctedExpense: ExpenseImportData) => void;
  onCancel: () => void;
}

export const ClassificationCorrectionModal = ({ open, expense, progress, onConfirm, onCancel }: Props) => {
  const translate = useTranslate();
  const [method, setMethod] = useState<string>('other');

  useEffect(() => {
    if (expense) {
      setMethod(expense.payment_method || 'other');
    }
  }, [expense]);

  const handleSave = () => {
    onConfirm({ ...expense, payment_method: method });
  };

  const paymentMethods = [
    { id: 'credit_card', name: 'resources.expenses.fields.payment_methods.credit_card' },
    { id: 'direct_debit', name: 'resources.expenses.fields.payment_methods.direct_debit' },
    { id: 'transfer', name: 'resources.expenses.fields.payment_methods.transfer' },
    { id: 'check', name: 'resources.expenses.fields.payment_methods.check' },
    { id: 'cash', name: 'resources.expenses.fields.payment_methods.cash' },
    { id: 'other', name: 'resources.expenses.fields.payment_methods.other' },
  ];

  if (!expense) return null;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>
        {translate('resources.expenses.import.correction_title')}
      </DialogTitle>
      <DialogContent>
        <Box mb={2} mt={1}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption" color="textSecondary">
              Traitement en cours...
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {progress.current} / {progress.total}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} />
        </Box>

        <Typography variant="body1" paragraph>
          {translate('resources.expenses.import.correction_desc')}
        </Typography>

        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mb: 3 }}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            {translate('resources.expenses.fields.description')}
          </Typography>
          <Typography variant="body1" gutterBottom fontWeight="bold">
            {expense.description}
          </Typography>

          <Box display="flex" justifyContent="space-between" mt={1}>
            <Typography variant="body2">
              {new Date(expense.date).toLocaleDateString()}
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(expense.amount)}
            </Typography>
          </Box>

          {expense.metadata?.import_type_hint && (
            <Box mt={2}>
              <Typography variant="caption" color="textSecondary" display="block">
                Type original détecté : {expense.metadata.import_type_hint}
              </Typography>
            </Box>
          )}

          {expense.confidence !== undefined && (
            <Box mt={1}>
              <Typography variant="caption" color={expense.confidence < CONFIG.CONFIDENCE_THRESHOLD ? 'error' : 'success'}>
                Confiance du modèle : {(expense.confidence * 100).toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Box>

        <FormControl fullWidth>
          <InputLabel>{translate('resources.expenses.fields.payment_method')}</InputLabel>
          <Select
            value={method}
            label={translate('resources.expenses.fields.payment_method')}
            onChange={(e) => setMethod(e.target.value)}
          >
            {paymentMethods.map(m => (
              <MenuItem key={m.id} value={m.id}>
                {translate(m.name)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          {translate('app.action.cancel')}
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          {translate('app.action.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
