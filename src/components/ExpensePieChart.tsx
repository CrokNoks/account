import { Box, Typography } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface DataPoint {
  name: string;
  value: number;
  color: string;
  [key: string]: any;
}

interface Props {
  data: DataPoint[];
}

export const ExpensePieChart = ({ data }: Props) => {
  if (!data || data.length === 0) {
    return <div>Aucune donnée à afficher</div>;
  }

  // Custom Legend to match the previous design
  const renderLegend = (props: any) => {
    const { payload } = props;
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 2 }}>
        {payload.map((entry: any, index: number) => {
            const item = data.find(d => d.name === entry.value);
            const value = item ? item.value : 0;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            
            return (
              <Box key={`item-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, backgroundColor: entry.color, borderRadius: '4px' }} />
                <Box sx={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 200 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{entry.value}</Typography>
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {percentage}%
                        </Typography>
                    </Box>
                </Box>
              </Box>
            );
        })}
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%', height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)}
          />
          <Legend 
            layout="vertical" 
            verticalAlign="middle" 
            align="right"
            content={renderLegend}
          />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};
