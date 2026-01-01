import { useState, useEffect } from 'react';
import { useWatch, useFormContext } from 'react-hook-form';
import { ReferenceInput, AutocompleteInput, useNotify } from 'react-admin';
import { Box, Typography } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { categoryClassifier } from '../../../services/CategoryClassifier';

interface SmartCategoryInputProps {
  source: string;
  selectedAccountId: string;
}

export const SmartCategoryInput = ({ source, selectedAccountId }: SmartCategoryInputProps) => {
  const { setValue, getValues } = useFormContext();
  const notify = useNotify();

  // Watch fields for prediction
  const description = useWatch({ name: 'description' });
  const amount = useWatch({ name: 'amount' });
  const notes = useWatch({ name: 'notes' });

  const [prediction, setPrediction] = useState<{ id: string; name: string; score: number } | null>(null);
  const [modelReady, setModelReady] = useState(false);

  // Initialize model
  useEffect(() => {
    if (selectedAccountId) {
      categoryClassifier.init(selectedAccountId).then(() => {
        setModelReady(true);
      });
    }
  }, [selectedAccountId]);

  // Predict when values change
  useEffect(() => {
    if (!modelReady || !description) {
      setPrediction(null);
      return;
    }

    const predict = async () => {
      try {
        const pred = await categoryClassifier.predict({
          description,
          amount: Number(amount) || 0,
          notes: notes || '',
        });

        if (pred && pred.score > 0.1) { // Threshold for suggestion
          setPrediction(pred);
          // Auto-select if high confidence and field is empty
          if (pred.score > 0.8) {
            // Check if the current value of the category field is empty or not set by the user
            // We use getValues here to get the most up-to-date value without making it a useEffect dependency
            const currentFieldValue = getValues(source);
            if (!currentFieldValue) {
              setValue(source, pred.id, { shouldDirty: true });
              notify('Catégorie détectée : ' + pred.name, { type: 'info', autoHideDuration: 2000 });
            }
          }
        } else {
          setPrediction(null);
        }
      } catch (e) {
        console.error("Prediction error", e);
      }
    };

    const timer = setTimeout(predict, 500); // Debounce
    return () => clearTimeout(timer);
  }, [description, amount, notes, modelReady, setValue, source, notify, getValues]); // Added getValues to dependencies

  const applyPrediction = () => {
    if (prediction) {
      setValue(source, prediction.id, { shouldDirty: true });
      notify('Catégorie suggérée appliquée', { type: 'success' });
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {prediction && (
        <Box
          display="flex"
          alignItems="center"
          gap={1}
          mt={1}
          sx={{ cursor: 'pointer', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}
          onClick={applyPrediction}
        >
          <AutoFixHighIcon fontSize="small" color="primary" />
          <Typography variant="body2" color="primary">
            Suggestion : <strong>{prediction.name}</strong> ({Math.round(prediction.score * 100)}%)
          </Typography>
        </Box>
      )}
      <ReferenceInput
        source={source}
        reference="categories"
        filter={{ account_id: selectedAccountId }}
        perPage={100}
        sort={{ field: 'name', order: 'ASC' }}
        fullWidth
      >
        <AutocompleteInput
          optionText="name"
          label="resources.expenses.fields.category_id"
          filterToQuery={searchText => ({ name: searchText })}
          fullWidth
          renderOption={(props: any, option: any) => (
            <li {...props}>
              {prediction && option.id === prediction.id ? (
                <Box component="span" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                  <AutoFixHighIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                  {option.name}
                  <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                    ({Math.round(prediction.score * 100)}%)
                  </Typography>
                </Box>
              ) : option.name}
            </li>
          )}
        />
      </ReferenceInput>
    </Box>
  );
};
