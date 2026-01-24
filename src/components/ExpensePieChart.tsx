import React, { useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// Enhanced interfaces following TypeScript guidelines
interface DataPoint {
  name: string;
  value: number;
  color: string;
  percentage?: number;
  [key: string]: number | string | undefined; // Add index signature for recharts compatibility
}

interface ExpensePieChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  showLabels?: boolean;
}

// Memoized currency formatter following performance guidelines
const formatCurrency = useCallback((value: number): string => 
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value),
  []
);

// Memoized pie chart component following performance guidelines
export const ExpensePieChart: React.FC<ExpensePieChartProps> = React.memo(({ 
  data, 
  title = 'Répartition des dépenses', 
  height = 300,
  showLabels = true 
}) => {
  const processedData = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    return data.map(item => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0
    }));
  }, [data]);

  // Memoized legend renderer
  const renderLegend = useCallback((props: any): React.ReactNode => {
    const { payload } = props;
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 2 }}>
        {payload.map((entry: any, index: number) => {
            const item = processedData.find(d => d.name === entry.value);
            const value = item ? item.value : 0;
            const percentage = item ? item.percentage.toFixed(1) : '0.0';
            
            return (
              <Box 
                key={`legend-item-${index}`} 
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Box 
                  sx={{ 
                    width: 16, 
                    height: 16, 
                    backgroundColor: entry.color, 
                    borderRadius: '4px' 
                  }} 
                />
                <Box 
                  sx={{ 
                    flex: 1, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    minWidth: 200 
                  }}
                >
                  <Typography variant="body2">
                    {entry.value}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(value)} ({percentage}%)
                  </Typography>
                </Box>
              </Box>
            );
          })}
      </Box>
    );
  }, [processedData, formatCurrency]);

  // Memoized tooltip renderer
  const renderTooltip = useCallback((props: any): React.ReactNode => {
    if (props.active && props.payload && props.payload.length) {
      const data = props.payload[0];
      const item = processedData.find(d => d.name === data.name);
      const percentage = item ? item.percentage.toFixed(1) : '0.0';
      
      return (
        <Box sx={{ 
          bgcolor: 'background.paper', 
          border: '1px solid', 
          borderColor: 'divider', 
          borderRadius: 1, 
          p: 1 
        }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {data.name}
          </Typography>
          <Typography variant="body2">
            {formatCurrency(data.value)} ({percentage}%)
          </Typography>
        </Box>
      );
    }
    return null;
  }, [processedData, formatCurrency]);

  if (!data || data.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Aucune donnée disponible
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height }}>
      {title && (
        <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
          {title}
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={height - (title ? 40 : 0)}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            label={showLabels ? (entry: any) => `${entry.percentage?.toFixed(1) || '0'}%` : false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={renderTooltip} />
          <Legend content={renderLegend} />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
});

ExpensePieChart.displayName = 'ExpensePieChart';