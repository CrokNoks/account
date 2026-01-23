import { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  TrendingUp,
  TrendingDown,
  Warning,
  CheckCircle,
  Info,
  Settings,
  Refresh,
} from "@mui/icons-material";
import { useAccount } from "../../context/AccountContext";
import { useGetList } from "react-admin";
import { usePeriodReport } from "../reports/hooks/usePeriodReport";
import { BudgetAlerts } from "./BudgetAlerts";
import { BudgetVisualization } from "./BudgetVisualization";
import { BudgetPeriodSelector } from "./components/BudgetPeriodSelector";

interface BudgetSummary {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
  type: "expense" | "income" | "savings";
  isOverBudget: boolean;
  status: "warning" | "success" | "error" | "info";
}

export const BudgetDashboard = () => {
  const { selectedAccountId } = useAccount();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  // Get budget templates for account
  const { isLoading: templatesLoading } = useGetList("budget-templates", {
    filter: { account_id: selectedAccountId },
    pagination: { page: 1, perPage: 100 },
  });

  // Get current period report data
  const {
    data: reportData,
    loading: reportLoading,
    refetch,
  } = usePeriodReport(selectedPeriodId || null);

  // Handle period change
  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
  };

  const refreshData = () => {
    refetch();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getBudgetStatus = (spent: number, budgeted: number, type: string) => {
    if (budgeted <= 0) return { status: 'info', isOverBudget: false, percentage: 0 };
    
    const percentage = Math.round((Math.abs(spent) / budgeted) * 100);
    
    if (type === 'expense') {
      if (percentage >= 100) return { status: 'error', isOverBudget: true, percentage };
      if (percentage >= 80) return { status: 'warning', isOverBudget: false, percentage };
      return { status: 'success', isOverBudget: false, percentage };
    } else {
      // For income and savings, higher percentage is better
      if (percentage >= 100) return { status: 'success', isOverBudget: false, percentage };
      if (percentage >= 50) return { status: 'info', isOverBudget: false, percentage };
      return { status: 'warning', isOverBudget: false, percentage };
    }
  };

  const budgetSummaries: BudgetSummary[] =
    (reportData?.categoryBreakdown || []).map((item: any) => {
      const status = getBudgetStatus(item.spent, item.budgeted, item.type);
      return {
        categoryId: item.category.id,
        categoryName: item.category.name,
        categoryColor: item.category.color,
        budgeted: item.budgeted,
        spent: Math.abs(item.spent),
        remaining: item.budgeted - Math.abs(item.spent),
        percentage: status.percentage,
        type: item.type as "expense" | "income" | "savings",
        isOverBudget: status.isOverBudget,
        status: status.status as "warning" | "success" | "error" | "info",
      };
    }) || [];

  // Calculate overall stats
  const totalBudgeted = budgetSummaries.reduce(
    (sum, item) => sum + item.budgeted,
    0,
  );
  const totalSpent = budgetSummaries.reduce((sum, item) => sum + item.spent, 0);
  const overBudgetCount = budgetSummaries.filter(
    (item) => item.isOverBudget,
  ).length;
  const warningCount = budgetSummaries.filter(
    (item) => item.status === "warning",
  ).length;

  if (!selectedAccountId) {
    return (
      <Alert severity="info">
        Veuillez sélectionner un compte pour voir votre tableau de bord
        budgétaire.
      </Alert>
    );
  }

  if (!selectedPeriodId) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <Typography variant="h6" gutterBottom color="text.secondary">
              Sélectionnez une période
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
            >
              Choisissez une période dans le menu déroulant pour voir les
              budgets correspondants.
            </Typography>

            {/* Period Selector */}
            <BudgetPeriodSelector
              onPeriodChange={handlePeriodChange}
            />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (reportLoading || templatesLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <Typography>Chargement des données budgétaires...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" flexDirection="column" gap={2} mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" component="h1">
            Tableau de Bord Budgétaire
          </Typography>
          <Box>
            <Tooltip title="Actualiser">
              <IconButton onClick={refreshData} color="primary">
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Paramètres budgétaires">
              <IconButton color="primary" href="/budget-templates">
                <Settings />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Period Selector */}
        <BudgetPeriodSelector
          selectedPeriodId={selectedPeriodId}
          onPeriodChange={handlePeriodChange}
        />
      </Box>

      {/* Budget Alerts */}
      <BudgetAlerts />

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <TrendingUp color="primary" />
                <Typography variant="h6">Budget Total</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {formatCurrency(totalBudgeted)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {budgetSummaries.length} catégories
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <TrendingDown color="info" />
                <Typography variant="h6">Dépensé</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {formatCurrency(totalSpent)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {totalBudgeted > 0
                  ? Math.round((totalSpent / totalBudgeted) * 100)
                  : 0}
                % du budget
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CheckCircle color="success" />
                <Typography variant="h6">Restant</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {formatCurrency(totalBudgeted - totalSpent)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {Math.max(
                  0,
                  100 - Math.round((totalSpent / totalBudgeted) * 100),
                )}
                % disponible
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Warning color={overBudgetCount > 0 ? "error" : "success"} />
                <Typography variant="h6">Alertes</Typography>
              </Box>
              <Typography
                variant="h4"
                color={overBudgetCount > 0 ? "error.main" : "success.main"}
              >
                {overBudgetCount + warningCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {overBudgetCount} dépassements, {warningCount} avertissements
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Budget Categories */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="error.main">
                Dépenses
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                {budgetSummaries
                  .filter((item) => item.type === "expense")
                  .sort((a, b) => b.percentage - a.percentage)
                  .map((budget) => (
                    <BudgetProgressCard
                      key={budget.categoryId}
                      budget={budget}
                    />
                  ))}
                {budgetSummaries.filter((item) => item.type === "expense")
                  .length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Aucune catégorie de dépense avec budget défini
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="success.main">
                Revenus et Épargne
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                {budgetSummaries
                  .filter(
                    (item) => item.type === "income" || item.type === "savings",
                  )
                  .sort((a, b) => b.percentage - a.percentage)
                  .map((budget) => (
                    <BudgetProgressCard
                      key={budget.categoryId}
                      budget={budget}
                    />
                  ))}
                {budgetSummaries.filter(
                  (item) => item.type === "income" || item.type === "savings",
                ).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Aucune catégorie de revenu ou d'épargne avec budget défini
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Budget Visualizations */}
      {selectedPeriodId && <BudgetVisualization periodId={selectedPeriodId} />}
    </Box>
  );
};

interface BudgetProgressCardProps {
  budget: BudgetSummary;
}

export const BudgetProgressCard = ({ budget }: BudgetProgressCardProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case "error":
        return "error";
      case "warning":
        return "warning";
      case "success":
        return "success";
      default:
        return "primary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "error":
        return <TrendingDown color="error" />;
      case "warning":
        return <Warning color="warning" />;
      case "success":
        return <CheckCircle color="success" />;
      default:
        return <Info color="action" />;
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor:
          budget.status === "error" ? "error.lighter" : "background.paper",
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              bgcolor: budget.categoryColor,
              border: "1px solid rgba(0,0,0,0.1)",
            }}
          />
          <Typography variant="body2" fontWeight="medium">
            {budget.categoryName}
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            {getStatusIcon(budget.status)}
            <Chip
              label={`${budget.percentage}%`}
              size="small"
              color={getProgressColor(budget.status) as any}
              variant={budget.status === "error" ? "filled" : "outlined"}
              sx={{
                fontWeight: "bold",
                minWidth: "50px",
                "& .MuiChip-label": {
                  px: 1,
                },
              }}
            />
          </Box>
        </Box>
      </Box>

      <LinearProgress
        variant="determinate"
        value={Math.min(budget.percentage, 100)}
        color={getProgressColor(budget.status) as any}
        sx={{ mb: 1, height: 8, borderRadius: 4 }}
      />

      <Box display="flex" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          Dépensé: {formatCurrency(budget.spent)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Budget: {formatCurrency(budget.budgeted)}
        </Typography>
      </Box>

      {budget.remaining < 0 && (
        <Typography variant="caption" color="error" fontWeight="medium">
          Dépassement de {formatCurrency(Math.abs(budget.remaining))}
        </Typography>
      )}
    </Box>
  );
};
