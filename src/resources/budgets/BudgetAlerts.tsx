import { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItem,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Divider
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Warning,
  TrendingDown,
  Info
} from '@mui/icons-material';
import { useAccount } from '../../context/AccountContext';
import { useGetList } from 'react-admin';
import { usePeriodReport } from '../reports/hooks/usePeriodReport';

interface BudgetAlert {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  type: 'over_budget' | 'warning' | 'info';
  message: string;
  severity: 'error' | 'warning' | 'info';
  percentage: number;
  budgeted: number;
  spent: number;
  remaining: number;
}

interface BudgetAlertSettings {
  enableOverBudgetAlerts: boolean;
  enableWarningAlerts: boolean;
  warningThreshold: number; // percentage
}

export const BudgetAlerts = () => {
  const { selectedAccountId } = useAccount();
  const [expanded, setExpanded] = useState(true);
  const [settings, setSettings] = useState<BudgetAlertSettings>({
    enableOverBudgetAlerts: true,
    enableWarningAlerts: true,
    warningThreshold: 80
  });

  // Get current active period
  const { data: activePeriods } = useGetList('periods', {
    filter: { account_id: selectedAccountId, is_active: true },
    pagination: { page: 1, perPage: 1 }
  });
  
  const activePeriod = activePeriods?.[0];

  // Get current period report data
  const { data: reportData, loading } = usePeriodReport(activePeriod?.id || null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const generateAlerts = (): BudgetAlert[] => {
    if (!reportData?.categoryBreakdown) return [];

    const alerts: BudgetAlert[] = [];

    reportData.categoryBreakdown.forEach((item: any) => {
      const spent = Math.abs(item.spent);
      const budgeted = item.budgeted;
      const percentage = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
      const remaining = budgeted - spent;

      // Over budget alerts
      if (percentage >= 100 && settings.enableOverBudgetAlerts) {
        alerts.push({
          id: `over-${item.category.id}`,
          categoryId: item.category.id,
          categoryName: item.category.name,
          categoryColor: item.category.color,
          type: 'over_budget',
          message: `Dépassement de budget de ${formatCurrency(Math.abs(remaining))}`,
          severity: 'error',
          percentage,
          budgeted,
          spent,
          remaining
        });
      }
      // Warning alerts
      else if (percentage >= settings.warningThreshold && settings.enableWarningAlerts) {
        alerts.push({
          id: `warning-${item.category.id}`,
          categoryId: item.category.id,
          categoryName: item.category.name,
          categoryColor: item.category.color,
          type: 'warning',
          message: `${percentage - settings.warningThreshold + 10}% du budget utilisé`,
          severity: 'warning',
          percentage,
          budgeted,
          spent,
          remaining
        });
      }
      // Info alerts for good performance (income categories)
      else if (item.type === 'income' && percentage >= 50 && budgeted > 0) {
        alerts.push({
          id: `info-${item.category.id}`,
          categoryId: item.category.id,
          categoryName: item.category.name,
          categoryColor: item.category.color,
          type: 'info',
          message: `Objectif de revenu à ${percentage}% atteint`,
          severity: 'info',
          percentage,
          budgeted,
          spent,
          remaining
        });
      }
    });

    return alerts.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  };

  const alerts = generateAlerts();
  const errorCount = alerts.filter(a => a.severity === 'error').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const infoCount = alerts.filter(a => a.severity === 'info').length;

  const handleSettingChange = (key: keyof BudgetAlertSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // TODO: Save to localStorage or user preferences
  };

  if (!selectedAccountId || !activePeriod || loading) {
    return null;
  }

  if (alerts.length === 0) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1}>
            <Info color="success" />
            <Typography variant="body1" color="success.main">
              Tous les budgets sont dans les limites définies ! 🎉
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'over_budget': return <TrendingDown color="error" />;
      case 'warning': return <Warning color="warning" />;
      default: return <Info color="info" />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6">
              Alertes Budgétaires
            </Typography>
            <Box display="flex" gap={1}>
              {errorCount > 0 && (
                <Chip label={`${errorCount} critique${errorCount > 1 ? 's' : ''}`} color="error" size="small" />
              )}
              {warningCount > 0 && (
                <Chip label={`${warningCount} avertissement${warningCount > 1 ? 's' : ''}`} color="warning" size="small" />
              )}
              {infoCount > 0 && (
                <Chip label={`${infoCount} info`} color="info" size="small" />
              )}
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Box mt={2}>
            {/* Settings */}
            <Box display="flex" gap={2} mb={2} flexWrap="wrap">
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enableOverBudgetAlerts}
                    onChange={(e) => handleSettingChange('enableOverBudgetAlerts', e.target.checked)}
                    size="small"
                  />
                }
                label="Alertes de dépassement"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enableWarningAlerts}
                    onChange={(e) => handleSettingChange('enableWarningAlerts', e.target.checked)}
                    size="small"
                  />
                }
                label="Avertissements"
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Alert List */}
            <List dense>
              {alerts.map((alert, index) => (
                <Box key={alert.id}>
                  <ListItem sx={{ px: 0, py: 1 }}>
                    <Box display="flex" alignItems="flex-start" gap={2} width="100%">
                      {getAlertIcon(alert.type)}
                      <Box flex={1}>
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: alert.categoryColor,
                              border: '1px solid rgba(0,0,0,0.1)'
                            }}
                          />
                          <Typography variant="body2" fontWeight="medium">
                            {alert.categoryName}
                          </Typography>
                          <Chip
                            label={`${alert.percentage}%`}
                            size="small"
                            color={getAlertColor(alert.severity) as any}
                            variant="outlined"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {alert.message}
                        </Typography>
                        <Box display="flex" gap={2} mt={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            Dépensé: {formatCurrency(alert.spent)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Budget: {formatCurrency(alert.budgeted)}
                          </Typography>
                          {alert.remaining < 0 && (
                            <Typography variant="caption" color="error" fontWeight="medium">
                              Dépassement: {formatCurrency(Math.abs(alert.remaining))}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </ListItem>
                  {index < alerts.length - 1 && <Divider variant="inset" />}
                </Box>
              ))}
            </List>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};