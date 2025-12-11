import { useState } from 'react';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, IconButton, Menu } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { useIsSmall } from '../../../hooks/isSmall';

interface ReportSelectorProps {
  selectedReportId: string;
  history: any[];
  onReportChange: (reportId: string) => void;
  children?: React.ReactNode;
}

export const ReportSelector = ({ selectedReportId, history, onReportChange, children }: ReportSelectorProps) => {
  const isSmall = useIsSmall();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (reportId: string) => {
    onReportChange(reportId);
    handleClose();
  };

  if (isSmall) {
    return (
      <Box display="flex" alignItems="center" width="100%" mb={2}>
        <IconButton
          id="report-menu-button"
          aria-controls={open ? 'report-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={handleClick}
          edge="start"
          sx={{ mr: 1 }}
        >
          <HistoryIcon />
        </IconButton>

        <Typography variant="h5" sx={{ whiteSpace: 'nowrap' }}>
          Rapports
        </Typography>

        <Box flexGrow={1} />

        <Box>
          {children}
        </Box>

        <Menu
          id="report-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          MenuListProps={{
            'aria-labelledby': 'report-menu-button',
          }}
        >
          <MenuItem
            selected={selectedReportId === 'new'}
            onClick={() => handleMenuItemClick('new')}
          >
            Rapport en cours (non sauvegardé)
          </MenuItem>
          {history.map((report: any) => (
            <MenuItem
              key={report.id}
              selected={selectedReportId === report.id}
              onClick={() => handleMenuItemClick(report.id)}
            >
              {new Date(report.start_date).toLocaleDateString()} - {new Date(report.end_date).toLocaleDateString()}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    );
  }

  return (
    <Box display="flex" alignItems="center" gap={2} width="100%" mb={2}>
      <Typography variant="h5" sx={{ whiteSpace: 'nowrap' }}>
        Rapports
      </Typography>
      <FormControl size="small" sx={{ minWidth: 200 }}>
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

      <Box flexGrow={1} />

      <Box display="flex" gap={1}>
        {children}
      </Box>
    </Box>
  );
};
