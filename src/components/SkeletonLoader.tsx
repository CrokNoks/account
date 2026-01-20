import React from 'react';
import { Box, Skeleton, Card, Typography } from '@mui/material';

interface SkeletonLoaderProps {
  type: 'expense' | 'expenses' | 'category' | 'categories' | 'report' | 'account' | 'accounts' | 'form' | 'table';
  count?: number;
  columns?: number;
  children: React.ReactNode;
  isLoading?: boolean;
}

// Individual skeleton components
const ExpenseSkeleton = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
    <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
    <Box sx={{ flex: 1 }}>
      <Skeleton variant="text" width="60%" height={20} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="40%" height={16} />
    </Box>
    <Skeleton variant="rectangular" width={100} height={32} sx={{ mx: 1 }} />
    <Skeleton variant="rectangular" width={80} height={32} sx={{ mx: 1 }} />
    <Skeleton variant="rectangular" width={40} height={32} />
  </Box>
);

const CategorySkeleton = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
    <Skeleton variant="circular" width={24} height={24} sx={{ mr: 2 }} />
    <Skeleton variant="text" width="40%" height={20} sx={{ mr: 2 }} />
    <Skeleton variant="text" width={80} height={20} sx={{ mr: 2 }} />
    <Skeleton variant="text" width={60} height={20} />
  </Box>
);

const ReportDashboardSkeleton = () => (
  <Box sx={{ display: 'grid', gap: 3 }}>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} sx={{ p: 2 }}>
          <Skeleton variant="text" width="60%" height={16} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="80%" height={32} />
        </Card>
      ))}
    </Box>
    
    <Card sx={{ p: 2, height: 400 }}>
      <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" width="100%" height={320} />
    </Card>
    
    <Card sx={{ p: 2 }}>
      <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
      <Box>
        {Array.from({ length: 5 }).map((_, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Skeleton variant="text" width="20%" height={16} />
            <Skeleton variant="text" width="40%" height={16} sx={{ mx: 2 }} />
            <Skeleton variant="text" width="20%" height={16} />
          </Box>
        ))}
      </Box>
    </Card>
  </Box>
);

const AccountSkeleton = () => (
  <Card sx={{ p: 2, mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Skeleton variant="circular" width={48} height={48} sx={{ mr: 2 }} />
        <Box>
          <Skeleton variant="text" width={120} height={24} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" width={80} height={16} />
        </Box>
      </Box>
      <Skeleton variant="text" width={100} height={24} />
    </Box>
  </Card>
);

const FormSkeleton = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <Box>
      <Skeleton variant="text" width="30%" height={16} sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" width="100%" height={56} />
    </Box>
    <Box>
      <Skeleton variant="text" width="30%" height={16} sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" width="100%" height={56} />
    </Box>
    <Box>
      <Skeleton variant="text" width="30%" height={16} sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" width="100%" height={56} />
    </Box>
    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
      <Skeleton variant="rectangular" width={120} height={40} />
      <Skeleton variant="rectangular" width={120} height={40} />
    </Box>
  </Box>
);

const TableSkeleton = ({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => (
  <Box>
    <Box sx={{ display: 'flex', borderBottom: '2px solid', borderColor: 'divider', pb: 1, mb: 1 }}>
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} variant="text" width={`${100 / columns}%`} height={20} sx={{ mr: 1 }} />
      ))}
    </Box>
    
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <Box key={rowIndex} sx={{ display: 'flex', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} variant="text" width={`${100 / columns}%`} height={20} sx={{ mr: 1 }} />
        ))}
      </Box>
    ))}
  </Box>
);

// Main component that renders skeleton when loading
export const SkeletonLoader = ({ type, count = 5, columns = 4, children, isLoading }: SkeletonLoaderProps) => {
  if (isLoading) {
    switch (type) {
      case 'expense':
        return <ExpenseSkeleton />;
      case 'expenses':
        return (
          <Box>
            {Array.from({ length: count }).map((_, index) => (
              <ExpenseSkeleton key={index} />
            ))}
          </Box>
        );
      case 'category':
        return <CategorySkeleton />;
      case 'categories':
        return (
          <Box>
            {Array.from({ length: count }).map((_, index) => (
              <CategorySkeleton key={index} />
            ))}
          </Box>
        );
      case 'report':
        return <ReportDashboardSkeleton />;
      case 'account':
        return <AccountSkeleton />;
      case 'accounts':
        return (
          <Box>
            {Array.from({ length: count }).map((_, index) => (
              <AccountSkeleton key={index} />
            ))}
          </Box>
        );
      case 'form':
        return <FormSkeleton />;
      case 'table':
        return <TableSkeleton rows={count} columns={columns} />;
      default:
        return <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography>Loading...</Typography>
        </Box>;
    }
  }

  return <>{children}</>;
};