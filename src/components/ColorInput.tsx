import { useInput } from 'react-admin';
import { Box, TextField } from '@mui/material';

interface ColorInputProps {
  source: string;
  label?: string;
  fullWidth?: boolean;
}

export const ColorInput = ({ source, label, fullWidth }: ColorInputProps) => {
  const {
    field,
    fieldState: { error },
  } = useInput({ source });

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: fullWidth ? '100%' : 'auto' }}>
      <input
        type="color"
        value={field.value || '#000000'}
        onChange={(e) => field.onChange(e.target.value)}
        style={{
          width: 60,
          height: 56,
          border: '1px solid rgba(0,0,0,0.23)',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      />
      <TextField
        {...field}
        label={label}
        error={!!error}
        helperText={error?.message}
        fullWidth={fullWidth}
        placeholder="#000000"
      />
    </Box>
  );
};
