
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Chip
} from '@mui/material';
import { useGetList } from 'react-admin';
import { useAccount } from '../../../context/AccountContext';
import { useEffect } from 'react';

interface PeriodSelectorProps {
  selectedPeriodId?: string | null;
  onPeriodChange: (periodId: string) => void;
  showActiveOnly?: boolean;
  label?: string;
}

export const BudgetPeriodSelector = ({ 
  selectedPeriodId = null, 
  onPeriodChange, 
  showActiveOnly = false,
  label = "Période"
}: PeriodSelectorProps) => {
  const { selectedAccountId } = useAccount();
  
  // Get all periods for account
  const { data: periods, isLoading } = useGetList('periods', {
    filter: { account_id: selectedAccountId },
    pagination: { page: 1, perPage: 100 },
    sort: { field: 'start_date', order: 'DESC' }
  });

  // Auto-select the most recent period if none is selected
  useEffect(() => {
    if (!selectedPeriodId && periods && periods.length > 0) {
      // Priority: active period first, then most recent period
      const activePeriod = periods.find(p => p.is_active);
      const defaultPeriod = activePeriod || periods[0];
      
      if (defaultPeriod?.id) {
        onPeriodChange(defaultPeriod.id);
      }
    }
  }, [selectedPeriodId, periods, onPeriodChange]);

  const formatPeriodLabel = (period: any) => {
    const startDate = new Date(period.start_date);
    const endDate = period.end_date ? new Date(period.end_date) : null;
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('fr-FR', { 
        month: 'short', 
        year: 'numeric' 
      });
    };
    
    if (period.is_active) {
      return `${formatDate(startDate)} - Aujourd'hui`;
    } else if (endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    } else {
      return formatDate(startDate);
    }
  };

  const getPeriodStatusIcon = (period: any) => {
    if (period.is_active) return '🔄';
    if (period.end_date) return '✅';
    return '📅';
  };

  if (isLoading) {
    return (
      <FormControl fullWidth disabled>
        <InputLabel>{label}</InputLabel>
        <Select value="" label={label}>
          <MenuItem value="">
            <Typography>Chargement...</Typography>
          </MenuItem>
        </Select>
      </FormControl>
    );
  }

  // Filter periods based on showActiveOnly prop
  const filteredPeriods = periods?.filter(period => {
    if (showActiveOnly) {
      return period.is_active === true;
    }
    // If no specific filter, return all periods
    return true;
  }) || [];

  return (
    <Box sx={{ mb: 3 }}>
      <FormControl fullWidth>
        <InputLabel>{label}</InputLabel>
        <Select
          value={selectedPeriodId || ''}
          label={label}
          onChange={(e) => onPeriodChange(e.target.value as string)}
          sx={{ minWidth: 300 }}
        >
          {filteredPeriods.length === 0 ? (
            <MenuItem value="" disabled>
              <Typography color="text.secondary">
                {showActiveOnly ? 'Aucune période active' : 'Aucune période trouvée'}
              </Typography>
            </MenuItem>
          ) : (
            filteredPeriods.map((period) => (
              <MenuItem key={period.id} value={period.id}>
                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography>
                      {getPeriodStatusIcon(period)} {formatPeriodLabel(period)}
                    </Typography>
                    {period.is_active && (
                      <Chip 
                        label="Active" 
                        size="small" 
                        color="success" 
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>
    </Box>
  );
};