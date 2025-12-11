import { useRecordContext } from 'react-admin';
import { Box } from '@mui/material';
import { CategoryShip } from './CategoryShip';

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
      <CategoryShip cat={{ color }} chipOnly />
    </Box>
  );
};
