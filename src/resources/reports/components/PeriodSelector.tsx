import { useGetList } from 'react-admin';
import { useAccount } from '../../../context/AccountContext';
import { TextField, MenuItem } from '@mui/material';

interface PeriodSelectorProps {
  selectedPeriodId: string | null;
  onPeriodChange: (id: string) => void;
}

export const PeriodSelector = ({ selectedPeriodId, onPeriodChange }: PeriodSelectorProps) => {
  const { selectedAccountId } = useAccount();

  const { data: periods, isLoading } = useGetList(
    'periods',
    {
      filter: { account_id: selectedAccountId },
      sort: { field: 'start_date', order: 'DESC' }
    }
  );

  if (!selectedAccountId || isLoading) return null;

  return (
    <TextField
      select
      label="Période"
      value={selectedPeriodId || ''}
      onChange={(e) => onPeriodChange(e.target.value)}
      size="small"
      sx={{ minWidth: 300 }}
      variant="outlined"
    >
      {periods?.map((period: any) => (
        <MenuItem key={period.id} value={period.id}>
          {`${new Date(period.start_date).toLocaleDateString()} - ${period.end_date ? new Date(period.end_date).toLocaleDateString() : 'En cours'}`}
        </MenuItem>
      ))}
    </TextField>
  );
};
