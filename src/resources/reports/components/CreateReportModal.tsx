import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, TextField } from '@mui/material';

interface CreateReportModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: () => void;
  params: {
    startDate: string;
    endDate: string;
    initialBalance: number;
  };
  onParamsChange: (params: any) => void;
}

export const CreateReportModal = ({
  open,
  onClose,
  onGenerate,
  params,
  onParamsChange
}: CreateReportModalProps) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Créer un nouveau rapport</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <TextField
            label="Date de début"
            type="date"
            value={params.startDate}
            onChange={(e) => onParamsChange({ ...params, startDate: e.target.value })}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Date de fin (Optionnel)"
            type="date"
            value={params.endDate}
            onChange={(e) => onParamsChange({ ...params, endDate: e.target.value })}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Laisser vide pour un rapport en cours"
          />
          <TextField
            label="Solde initial"
            type="number"
            value={params.initialBalance}
            onChange={(e) => onParamsChange({ ...params, initialBalance: Number(e.target.value) })}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={onGenerate} variant="contained" color="primary">
          Générer
        </Button>
      </DialogActions>
    </Dialog>
  );
};
