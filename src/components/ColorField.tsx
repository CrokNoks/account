import { useRecordContext } from 'react-admin';
import { Box } from '@mui/material';

interface ColorFieldProps {
  source: string;
  label?: string;
}

export const ColorField = ({ source }: ColorFieldProps) => {
  const record = useRecordContext();
  if (!record) return null;
  
  const color = record[source];
  
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: '4px',
          backgroundColor: color || '#ccc',
          border: '1px solid rgba(0,0,0,0.2)',
        }}
      />
      <span>{color}</span>
    </Box>
  );
};
