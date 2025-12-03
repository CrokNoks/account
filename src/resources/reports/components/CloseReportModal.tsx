import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, TextField, Typography } from '@mui/material';

interface CloseReportModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  closingDate: string;
  onDateChange: (date: string) => void;
}

export const CloseReportModal = ({
  open,
  onClose,
  onConfirm,
  closingDate,
  onDateChange
}: CloseReportModalProps) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Clôturer le rapport</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <Typography variant="body2" gutterBottom>
            Veuillez sélectionner la date de fin pour ce rapport. Les données seront recalculées pour inclure uniquement les opérations jusqu'à cette date.
          </Typography>
          <TextField
            label="Date de clôture"
            type="date"
            value={closingDate}
            onChange={(e) => onDateChange(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={onConfirm} variant="contained" color="secondary">
          Confirmer la clôture
        </Button>
      </DialogActions>
    </Dialog>
  );
};
