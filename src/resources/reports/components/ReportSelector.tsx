import { useState } from 'react';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, IconButton, Menu } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { useTranslate, useLocale } from 'react-admin';
import { useIsSmall } from '../../../hooks/isSmall';

interface ReportSelectorProps {
  selectedReportId: string;
  history: any[];
  onReportChange: (reportId: string) => void;
  children?: React.ReactNode;
}

export const ReportSelector = ({ selectedReportId, history, onReportChange, children }: ReportSelectorProps) => {
  const isSmall = useIsSmall();
  const translate = useTranslate();
  const locale = useLocale();
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
          {translate('app.dashboard.reports')}
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
            {translate('app.report_selector.current_report')}
          </MenuItem>
          {history.map((report: any) => (
            <MenuItem
              key={report.id}
              selected={selectedReportId === report.id}
              onClick={() => handleMenuItemClick(report.id)}
            >
              {new Date(report.start_date).toLocaleDateString(locale)} - {new Date(report.end_date).toLocaleDateString(locale)}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    );
  }

  return (
    <Box display="flex" alignItems="center" gap={2} width="100%" mb={2}>
      <Typography variant="h5" sx={{ whiteSpace: 'nowrap' }}>
        {translate('app.dashboard.reports')}
      </Typography>
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel id="report-select-label">{translate('app.report_selector.history')}</InputLabel>
        <Select
          labelId="report-select-label"
          value={selectedReportId}
          label={translate('app.report_selector.history')}
          onChange={(e) => onReportChange(e.target.value as string)}
          displayEmpty
        >
          <MenuItem value="" disabled>{translate('app.report_selector.select_report')}</MenuItem>
          <MenuItem value="new">{translate('app.report_selector.current_report')}</MenuItem>
          {history.map((report: any) => (
            <MenuItem key={report.id} value={report.id}>
              {new Date(report.start_date).toLocaleDateString(locale)} - {new Date(report.end_date).toLocaleDateString(locale)}
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
