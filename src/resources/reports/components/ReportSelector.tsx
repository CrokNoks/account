import { Box, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

interface ReportSelectorProps {
  selectedReportId: string;
  history: any[];
  onReportChange: (reportId: string) => void;
}

export const ReportSelector = ({ selectedReportId, history, onReportChange }: ReportSelectorProps) => {
  return (
    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} width={{ xs: '100%', md: 'auto' }}>
      <Typography variant="h5" sx={{ whiteSpace: 'nowrap' }}>
        Rapports
      </Typography>
      <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 200 }, width: { xs: '100%', md: 200 } }}>
        <InputLabel id="report-select-label">Historique</InputLabel>
        <Select
          labelId="report-select-label"
          value={selectedReportId}
          label="Historique"
          onChange={(e) => onReportChange(e.target.value as string)}
          displayEmpty
        >
          <MenuItem value="" disabled>Sélectionner un rapport</MenuItem>
          <MenuItem value="new">Rapport en cours (non sauvegardé)</MenuItem>
          {history.map((report: any) => (
            <MenuItem key={report.id} value={report.id}>
              {new Date(report.start_date).toLocaleDateString()} - {new Date(report.end_date).toLocaleDateString()}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};
