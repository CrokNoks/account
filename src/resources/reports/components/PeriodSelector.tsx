import { useGetList } from 'react-admin';
import { useAccount } from '../../../context/AccountContext';
import { TextField, MenuItem } from '@mui/material';

interface PeriodSelectorProps {
  selectedPeriodId: string | null;
  onPeriodChange: (id: string) => void;
}

import { IconButton, Box, Tooltip } from '@mui/material';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useEffect } from 'react';

export const PeriodSelector = ({ selectedPeriodId, onPeriodChange }: PeriodSelectorProps) => {
  const { selectedAccountId } = useAccount();



  const { data: periods } = useGetList(
    'periods',
    {
      filter: { account_id: selectedAccountId },
      sort: { field: 'start_date', order: 'DESC' }
    }
  );

  useEffect(() => {
    if (!selectedPeriodId && periods && periods.length > 0) {
      onPeriodChange(periods[0].id);
    }
  }, [periods, selectedPeriodId, onPeriodChange]);

  if (!selectedAccountId || !periods) return null;

  const currentIndex = periods.findIndex(p => p.id === selectedPeriodId);

  // DESC sort: 0 is newest, N is oldest
  // "Previous" usually means "Back in time" -> Older -> index + 1
  // "Next" usually means "Forward in time" -> Newer -> index - 1

  const handlePrevious = () => {
    if (currentIndex < periods.length - 1) {
      onPeriodChange(periods[currentIndex + 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex > 0) {
      onPeriodChange(periods[currentIndex - 1].id);
    }
  };

  const isOldest = currentIndex === periods.length - 1 || currentIndex === -1;
  const isNewest = currentIndex === 0 || currentIndex === -1;

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Tooltip title="Précédent">
        <span>
          <IconButton onClick={handlePrevious} disabled={isOldest}>
            <ArrowBackIosIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <TextField
        select
        label="Période"
        value={selectedPeriodId || ''}
        onChange={(e) => onPeriodChange(e.target.value)}
        size="small"
        sx={{ minWidth: 300 }}
        variant="outlined"
      >
        {periods.map((period: any) => (
          <MenuItem key={period.id} value={period.id}>
            {`${period.start_date ? new Date(period.start_date).toLocaleDateString() : 'N/A'} - ${period.end_date ? new Date(period.end_date).toLocaleDateString() : 'En cours'}`}
          </MenuItem>
        ))}
      </TextField>

      <Tooltip title="Suivant">
        <span>
          <IconButton onClick={handleNext} disabled={isNewest}>
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};
