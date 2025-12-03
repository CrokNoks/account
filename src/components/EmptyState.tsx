import { ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onActionClick?: () => void;
  icon?: ReactNode;
}

export const EmptyState = ({
  title,
  description,
  actionLabel,
  onActionClick,
  icon,
}: EmptyStateProps) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      minHeight={200}
      gap={1}
      p={2}
    >
      {icon && <Box mb={1}>{icon}</Box>}
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" mb={1}>
          {description}
        </Typography>
      )}
      {actionLabel && onActionClick && (
        <Button variant="contained" color="primary" onClick={onActionClick} size="small">
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};


