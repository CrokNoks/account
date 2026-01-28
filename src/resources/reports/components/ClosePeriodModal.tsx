import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, TextField, Typography } from '@mui/material';

interface ClosePeriodModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (endDate: string) => void;
  closingDate: string;
  onDateChange: (date: string) => void;
  periodStartDate: string;
}

export const ClosePeriodModal = ({
  open,
  onClose,
  onConfirm,
  closingDate,
  onDateChange,
  periodStartDate
}: ClosePeriodModalProps) => {
  const handleConfirm = () => {
    // Validate that end date is after or equal to start date
    if (closingDate < periodStartDate) {
      return; // Could add error handling here
    }
    onConfirm(closingDate);
  };

  const handleDateChange = (date: string) => {
    // Validate that end date is after or equal to start date
    if (date >= periodStartDate) {
      onDateChange(date);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Clôturer la période</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <Typography variant="body2" gutterBottom>
            Veuillez sélectionner la date de fin pour cette période. Les opérations seront prises en compte jusqu'à cette date incluse.
          </Typography>
          <TextField
            label="Date de clôture"
            type="date"
            value={closingDate}
            onChange={(e) => handleDateChange(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{
              min: periodStartDate,
              max: new Date().toISOString().split('T')[0]
            }}
          />
          <Typography variant="caption" color="text.secondary">
            La date doit être postérieure ou égale à la date de début de période ({periodStartDate})
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          color="primary"
          disabled={closingDate < periodStartDate}
        >
          Confirmer la clôture
        </Button>
      </DialogActions>
    </Dialog>
  );
};